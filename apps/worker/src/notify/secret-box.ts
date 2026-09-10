/**
 * Shared AES-GCM secret box for notification-channel credentials.
 *
 * Wire format is byte-compatible with the original Telegram-only helper:
 *   `v1:<base64(iv)>:<base64(ciphertext)>`
 * (standard base64, `:` separator) so credentials already stored in D1 keep
 * decrypting unchanged.
 *
 * Key material: SHA-256(`${context}:${adminToken.trim()}`).
 */

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();
const CIPHER_PREFIX = 'v1';
const IV_BYTES = 12;

export const TELEGRAM_BOT_TOKEN_CONTEXT = 'uptimer.telegram.bot-token.v1';
export const BARK_DEVICE_KEY_CONTEXT = 'uptimer.bark.device-key.v1';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(adminToken: string, context: string): Promise<CryptoKey> {
  const token = adminToken.trim();
  if (!token) {
    throw new Error('ADMIN_TOKEN is required for notification credential encryption');
  }

  const material = await crypto.subtle.digest('SHA-256', ENCODER.encode(`${context}:${token}`));
  return crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(
  adminToken: string,
  plaintext: string,
  context: string,
): Promise<string> {
  const key = await deriveKey(adminToken, context);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    ENCODER.encode(plaintext),
  );

  return `${CIPHER_PREFIX}:${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(
  adminToken: string,
  ciphertext: string,
  context: string,
): Promise<string> {
  const [version, ivBase64, ciphertextBase64] = ciphertext.split(':');
  if (version !== CIPHER_PREFIX || !ivBase64 || !ciphertextBase64) {
    throw new Error('Invalid encrypted secret format');
  }

  const key = await deriveKey(adminToken, context);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivBase64) },
    key,
    fromBase64(ciphertextBase64),
  );

  return DECODER.decode(plaintext);
}
