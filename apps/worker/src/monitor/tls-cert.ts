import { connect } from 'cloudflare:sockets';

/**
 * Minimal TLS 1.2 certificate reader.
 *
 * Cloudflare Workers exposes neither `tls` from node nor a "peer certificate"
 * API on `fetch`, and this deployment does not enable the `nodejs_compat`
 * compatibility flag. So we perform the cheapest possible handshake ourselves
 * over `cloudflare:sockets`: we offer TLS 1.2 only (TLS 1.3 encrypts the
 * Certificate message, TLS 1.2 keeps it in the clear) and stop reading as soon
 * as the DER certificate is parsed. The handshake is never completed, no secret
 * is derived and nothing is verified - we only want the validity dates.
 */

export type TlsCertificateInfo = {
  notBefore: number | null;
  notAfter: number | null;
  issuer: string | null;
  subject: string | null;
  serialNumber: string | null;
};

export type TlsProbeResult =
  | { ok: true; certificate: TlsCertificateInfo; handshakeMs: number }
  | { ok: false; error: string; handshakeMs: number };

const TLS_RECORD_CHANGE_CIPHER_SPEC = 0x14;
const TLS_RECORD_ALERT = 0x15;
const TLS_RECORD_HANDSHAKE = 0x16;

const TLS_VERSION_1_2 = 0x0303;

const HANDSHAKE_CLIENT_HELLO = 0x01;
const HANDSHAKE_CERTIFICATE = 0x0b;

const MAX_TLS_RECORD_PAYLOAD = 24 * 1024;
const MAX_HANDSHAKE_BUFFER = 256 * 1024;

const CIPHER_SUITES = [
  0xc02f, // TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
  0xc030, // TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
  0xc02b, // TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
  0xc02c, // TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
  0x009c, // TLS_RSA_WITH_AES_128_GCM_SHA256
  0x009d, // TLS_RSA_WITH_AES_256_GCM_SHA384
  0x002f, // TLS_RSA_WITH_AES_128_CBC_SHA
  0x0035, // TLS_RSA_WITH_AES_256_CBC_SHA
  0x003c, // TLS_RSA_WITH_AES_128_CBC_SHA256
  0x003d, // TLS_RSA_WITH_AES_256_CBC_SHA256
] as const;

const SIGNATURE_ALGORITHMS = [
  0x0401, // rsa_pkcs1_sha256
  0x0501, // rsa_pkcs1_sha384
  0x0601, // rsa_pkcs1_sha512
  0x0403, // ecdsa_secp256r1_sha256
  0x0503, // ecdsa_secp384r1_sha384
  0x0603, // ecdsa_secp521r1_sha512
  0x0201, // rsa_pkcs1_sha1
  0x0203, // ecdsa_sha1
] as const;

class ByteWriter {
  private readonly bytes: number[] = [];

  u8(value: number): this {
    this.bytes.push(value & 0xff);
    return this;
  }

  u16(value: number): this {
    this.bytes.push((value >> 8) & 0xff, value & 0xff);
    return this;
  }

  u24(value: number): this {
    this.bytes.push((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
    return this;
  }

  raw(value: ArrayLike<number>): this {
    for (let i = 0; i < value.length; i += 1) {
      this.bytes.push((value[i] ?? 0) & 0xff);
    }
    return this;
  }

  get length(): number {
    return this.bytes.length;
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function toSocketHostname(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

function buildClientHello(serverName: string): Uint8Array {
  const hostBytes = new TextEncoder().encode(serverName);

  const body = new ByteWriter();
  body.u16(TLS_VERSION_1_2);
  body.raw(crypto.getRandomValues(new Uint8Array(32)));
  body.u8(0); // empty session id
  body.u16(CIPHER_SUITES.length * 2);
  for (const suite of CIPHER_SUITES) body.u16(suite);
  body.u8(1); // compression methods
  body.u8(0); // null compression

  const extensions = new ByteWriter();

  // server_name (SNI)
  const sni = new ByteWriter();
  sni.u16(hostBytes.length + 3);
  sni.u8(0); // host_name
  sni.u16(hostBytes.length);
  sni.raw(hostBytes);
  extensions.u16(0x0000);
  extensions.u16(sni.length);
  extensions.raw(sni.toUint8Array());

  // supported_groups
  const groups = new ByteWriter();
  const groupIds = [0x001d, 0x0017, 0x0018]; // x25519, secp256r1, secp384r1
  groups.u16(groupIds.length * 2);
  for (const id of groupIds) groups.u16(id);
  extensions.u16(0x000a);
  extensions.u16(groups.length);
  extensions.raw(groups.toUint8Array());

  // ec_point_formats
  extensions.u16(0x000b);
  extensions.u16(2);
  extensions.u8(1);
  extensions.u8(0);

  // signature_algorithms
  const sigAlgs = new ByteWriter();
  sigAlgs.u16(SIGNATURE_ALGORITHMS.length * 2);
  for (const alg of SIGNATURE_ALGORITHMS) sigAlgs.u16(alg);
  extensions.u16(0x000d);
  extensions.u16(sigAlgs.length);
  extensions.raw(sigAlgs.toUint8Array());

  // supported_versions: pin the maximum at TLS 1.2 so the certificate stays readable.
  extensions.u16(0x002b);
  extensions.u16(3);
  extensions.u8(2);
  extensions.u16(TLS_VERSION_1_2);

  body.u16(extensions.length);
  body.raw(extensions.toUint8Array());

  const handshake = new ByteWriter();
  handshake.u8(HANDSHAKE_CLIENT_HELLO);
  handshake.u24(body.length);
  handshake.raw(body.toUint8Array());

  const record = new ByteWriter();
  record.u8(TLS_RECORD_HANDSHAKE);
  record.u16(TLS_VERSION_1_2);
  record.u16(handshake.length);
  record.raw(handshake.toUint8Array());

  return record.toUint8Array();
}

type Tlv = {
  tag: number;
  valueStart: number;
  valueEnd: number;
  end: number;
};

function readTlv(bytes: Uint8Array, offset: number): Tlv | null {
  if (offset + 2 > bytes.length) return null;
  const tag = bytes[offset] ?? 0;
  const first = bytes[offset + 1] ?? 0;
  let length = 0;
  let cursor = offset + 2;

  if ((first & 0x80) === 0) {
    length = first;
  } else {
    const lengthBytes = first & 0x7f;
    if (lengthBytes === 0 || lengthBytes > 4) return null;
    if (cursor + lengthBytes > bytes.length) return null;
    for (let i = 0; i < lengthBytes; i += 1) {
      length = (length << 8) | (bytes[cursor + i] ?? 0);
    }
    cursor += lengthBytes;
  }

  const valueEnd = cursor + length;
  if (valueEnd > bytes.length) return null;
  return { tag, valueStart: cursor, valueEnd, end: valueEnd };
}

function childTlvs(bytes: Uint8Array, parent: Tlv): Tlv[] {
  const out: Tlv[] = [];
  let cursor = parent.valueStart;
  while (cursor < parent.valueEnd) {
    const child = readTlv(bytes, cursor);
    if (!child || child.end <= cursor) break;
    out.push(child);
    cursor = child.end;
  }
  return out;
}

function decodeAscii(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < end; i += 1) {
    out += String.fromCharCode(bytes[i] ?? 0);
  }
  return out;
}

function decodeAsn1String(bytes: Uint8Array, tlv: Tlv): string | null {
  const start = tlv.valueStart;
  const end = tlv.valueEnd;
  if (end <= start) return '';

  switch (tlv.tag) {
    case 0x13: // PrintableString
    case 0x16: // IA5String
    case 0x14: // TeletexString
    case 0x12: // NumericString
      return decodeAscii(bytes, start, end);
    case 0x1e: {
      // BMPString (UTF-16BE)
      let out = '';
      for (let i = start; i + 1 < end; i += 2) {
        out += String.fromCharCode(((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0));
      }
      return out;
    }
    default:
      try {
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(start, end));
      } catch {
        return decodeAscii(bytes, start, end);
      }
  }
}

function isCommonNameOid(bytes: Uint8Array, oid: Tlv): boolean {
  return (
    oid.tag === 0x06 &&
    oid.valueEnd - oid.valueStart === 3 &&
    bytes[oid.valueStart] === 0x55 &&
    bytes[oid.valueStart + 1] === 0x04 &&
    bytes[oid.valueStart + 2] === 0x03
  );
}

function isOrganizationOid(bytes: Uint8Array, oid: Tlv): boolean {
  return (
    oid.tag === 0x06 &&
    oid.valueEnd - oid.valueStart === 3 &&
    bytes[oid.valueStart] === 0x55 &&
    bytes[oid.valueStart + 1] === 0x04 &&
    bytes[oid.valueStart + 2] === 0x0a
  );
}

function decodeName(bytes: Uint8Array, name: Tlv): string | null {
  let commonName: string | null = null;
  let organization: string | null = null;

  for (const rdn of childTlvs(bytes, name)) {
    for (const attribute of childTlvs(bytes, rdn)) {
      const parts = childTlvs(bytes, attribute);
      const oid = parts[0];
      const value = parts[1];
      if (!oid || !value) continue;
      if (!commonName && isCommonNameOid(bytes, oid)) {
        commonName = decodeAsn1String(bytes, value);
      } else if (!organization && isOrganizationOid(bytes, oid)) {
        organization = decodeAsn1String(bytes, value);
      }
    }
  }

  return commonName ?? organization;
}

const UTC_TIME_PATTERN = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z?$/;
const GENERALIZED_TIME_PATTERN = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z?$/;

function parseAsn1Time(bytes: Uint8Array, tlv: Tlv): number | null {
  const raw = decodeAscii(bytes, tlv.valueStart, tlv.valueEnd).trim();

  if (tlv.tag === 0x17) {
    const match = UTC_TIME_PATTERN.exec(raw);
    if (!match) return null;
    const shortYear = Number.parseInt(match[1] ?? '', 10);
    const year = shortYear >= 50 ? 1900 + shortYear : 2000 + shortYear;
    return toEpochSeconds(year, match[2], match[3], match[4], match[5], match[6]);
  }

  if (tlv.tag === 0x18) {
    const match = GENERALIZED_TIME_PATTERN.exec(raw);
    if (!match) return null;
    return toEpochSeconds(
      Number.parseInt(match[1] ?? '', 10),
      match[2],
      match[3],
      match[4],
      match[5],
      match[6],
    );
  }

  return null;
}

function toEpochSeconds(
  year: number,
  month: string | undefined,
  day: string | undefined,
  hour: string | undefined,
  minute: string | undefined,
  second: string | undefined,
): number | null {
  const ms = Date.UTC(
    year,
    Number.parseInt(month ?? '1', 10) - 1,
    Number.parseInt(day ?? '1', 10),
    Number.parseInt(hour ?? '0', 10),
    Number.parseInt(minute ?? '0', 10),
    Number.parseInt(second ?? '0', 10),
  );
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

function toHex(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < end; i += 1) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, '0').toUpperCase();
  }
  return out;
}

function parseCertificateDer(der: Uint8Array): TlsCertificateInfo | null {
  const certificate = readTlv(der, 0);
  if (!certificate || certificate.tag !== 0x30) return null;

  const tbs = childTlvs(der, certificate)[0];
  if (!tbs || tbs.tag !== 0x30) return null;

  const fields = childTlvs(der, tbs);
  let index = 0;
  // Optional [0] EXPLICIT version.
  if (fields[0] && fields[0].tag === 0xa0) index += 1;

  const serial = fields[index];
  index += 1;
  index += 1; // signature AlgorithmIdentifier
  const issuer = fields[index];
  index += 1;
  const validity = fields[index];
  index += 1;
  const subject = fields[index];

  let notBefore: number | null = null;
  let notAfter: number | null = null;
  if (validity && validity.tag === 0x30) {
    const times = childTlvs(der, validity);
    if (times[0]) notBefore = parseAsn1Time(der, times[0]);
    if (times[1]) notAfter = parseAsn1Time(der, times[1]);
  }

  return {
    notBefore,
    notAfter,
    issuer: issuer && issuer.tag === 0x30 ? decodeName(der, issuer) : null,
    subject: subject && subject.tag === 0x30 ? decodeName(der, subject) : null,
    serialNumber: serial && serial.tag === 0x02 ? toHex(der, serial.valueStart, serial.valueEnd) : null,
  };
}

function parseCertificateMessage(body: Uint8Array): TlsCertificateInfo | null {
  if (body.length < 3) return null;
  const listLength = ((body[0] ?? 0) << 16) | ((body[1] ?? 0) << 8) | (body[2] ?? 0);
  if (body.length < 3 + listLength) return null;

  const certificateLength = ((body[3] ?? 0) << 16) | ((body[4] ?? 0) << 8) | (body[5] ?? 0);
  const start = 6;
  const end = start + certificateLength;
  if (certificateLength <= 0 || end > body.length) return null;

  return parseCertificateDer(body.slice(start, end));
}

export async function probeTlsCertificate(opts: {
  hostname: string;
  port: number;
  serverName?: string;
  timeoutMs: number;
}): Promise<TlsProbeResult> {
  const started = performance.now();
  const handshakeMs = () => Math.round(performance.now() - started);
  const serverName = (opts.serverName ?? opts.hostname).trim() || opts.hostname;

  let socket: ReturnType<typeof connect> | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const clientHello = buildClientHello(serverName);
    socket = connect({ hostname: toSocketHostname(opts.hostname), port: opts.port });

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Timeout after ${opts.timeoutMs}ms`)),
        opts.timeoutMs,
      );
    });

    await Promise.race([socket.opened, timeout]);

    reader = socket.readable.getReader();
    writer = socket.writable.getWriter();
    await Promise.race([writer.write(clientHello), timeout]);

    let recordBuffer = new Uint8Array(0);
    let handshakeBuffer = new Uint8Array(0);

    for (;;) {
      const read = await Promise.race([reader.read(), timeout]);
      if (read.done) {
        return { ok: false, error: 'Connection closed before a certificate was received', handshakeMs: handshakeMs() };
      }
      const chunk = read.value;
      if (chunk && chunk.length > 0) {
        recordBuffer = concatBytes(recordBuffer, chunk);

        while (recordBuffer.length >= 5) {
          const contentType = recordBuffer[0] ?? 0;
          const recordLength = ((recordBuffer[3] ?? 0) << 8) | (recordBuffer[4] ?? 0);
          if (recordLength > MAX_TLS_RECORD_PAYLOAD) {
            return { ok: false, error: 'TLS record too large', handshakeMs: handshakeMs() };
          }
          if (recordBuffer.length < 5 + recordLength) break;

          const payload = recordBuffer.slice(5, 5 + recordLength);
          recordBuffer = recordBuffer.slice(5 + recordLength);

          if (contentType === TLS_RECORD_ALERT) {
            const description = payload.length >= 2 ? ((payload[1] ?? 0) & 0xff) : 0;
            return {
              ok: false,
              error: `TLS handshake rejected by peer (alert ${description})`,
              handshakeMs: handshakeMs(),
            };
          }

          if (contentType !== TLS_RECORD_HANDSHAKE && contentType !== TLS_RECORD_CHANGE_CIPHER_SPEC) {
            continue;
          }
          if (contentType === TLS_RECORD_HANDSHAKE) {
            handshakeBuffer = concatBytes(handshakeBuffer, payload);
            if (handshakeBuffer.length > MAX_HANDSHAKE_BUFFER) {
              return { ok: false, error: 'TLS handshake too large', handshakeMs: handshakeMs() };
            }
          }
        }

        while (handshakeBuffer.length >= 4) {
          const messageType = handshakeBuffer[0] ?? 0;
          const messageLength =
            ((handshakeBuffer[1] ?? 0) << 16) |
            ((handshakeBuffer[2] ?? 0) << 8) |
            (handshakeBuffer[3] ?? 0);
          if (messageLength > MAX_HANDSHAKE_BUFFER) {
            return { ok: false, error: 'TLS handshake message too large', handshakeMs: handshakeMs() };
          }
          if (handshakeBuffer.length < 4 + messageLength) break;

          const messageBody = handshakeBuffer.slice(4, 4 + messageLength);
          handshakeBuffer = handshakeBuffer.slice(4 + messageLength);

          if (messageType === HANDSHAKE_CERTIFICATE) {
            const certificate = parseCertificateMessage(messageBody);
            if (!certificate) {
              return { ok: false, error: 'Failed to parse the TLS certificate', handshakeMs: handshakeMs() };
            }
            return { ok: true, certificate, handshakeMs: handshakeMs() };
          }
        }
      }
    }
  } catch (err) {
    return { ok: false, error: toErrorMessage(err), handshakeMs: handshakeMs() };
  } finally {
    if (timer) clearTimeout(timer);
    try {
      await reader?.cancel();
    } catch {
      // ignore
    }
    try {
      await writer?.close();
    } catch {
      // ignore
    }
    try {
      socket?.close();
    } catch {
      // ignore
    }
  }
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
