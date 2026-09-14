import { DEFAULT_NOTIFICATION_LOCALE, type BarkChannelConfig } from '@uptimer/db';

import { BARK_DEVICE_KEY_CONTEXT, decryptSecret, encryptSecret } from './secret-box';
import { defaultMessageForEvent, defaultTitleForEvent, renderStringTemplate } from './template';

/**
 * Bark push channel (https://bark.day.app).
 *
 * Talks to `<server_url>/push` with a JSON body, which works for both the
 * public `https://api.day.app` gateway and self-hosted Bark servers.
 */

export type ChannelDispatchResult = {
  status: 'success' | 'failed';
  httpStatus: number | null;
  error: string | null;
};

const DEFAULT_SERVER_URL = 'https://api.day.app';
const DEFAULT_TIMEOUT_MS = 5000;
const TITLE_MAX_LENGTH = 128;
const BODY_MAX_LENGTH = 4000;

export type BarkChannel = {
  id: number;
  name: string;
  config: BarkChannelConfig;
};

export async function encryptBarkDeviceKey(adminToken: string, deviceKey: string): Promise<string> {
  return encryptSecret(adminToken, deviceKey, BARK_DEVICE_KEY_CONTEXT);
}

export async function decryptBarkDeviceKey(adminToken: string, encrypted: string): Promise<string> {
  return decryptSecret(adminToken, encrypted, BARK_DEVICE_KEY_CONTEXT);
}

function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

function toErrorMessage(err: unknown): string {
  if (isAbortError(err)) return 'Request timed out';
  return err instanceof Error ? err.message : String(err);
}

function readEnvSecret(env: Record<string, unknown>, ref: string): string | null {
  const value = env[ref];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function redact(value: string, secret: string): string {
  if (!secret) return value;
  return value.split(secret).join('***');
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

async function resolveDeviceKey(env: Record<string, unknown>, config: BarkChannelConfig): Promise<
  { ok: true; deviceKey: string } | { ok: false; error: string }
> {
  if (config.device_key_encrypted) {
    const adminToken = readEnvSecret(env, 'ADMIN_TOKEN');
    if (!adminToken) {
      return { ok: false, error: 'ADMIN_TOKEN is required to decrypt the stored Bark device key' };
    }
    try {
      return { ok: true, deviceKey: await decryptBarkDeviceKey(adminToken, config.device_key_encrypted) };
    } catch {
      return { ok: false, error: 'Stored Bark device key could not be decrypted' };
    }
  }

  if (config.device_key_secret_ref) {
    const value = readEnvSecret(env, config.device_key_secret_ref);
    if (!value) {
      return {
        ok: false,
        error: `Bark device key secret "${config.device_key_secret_ref}" is not configured`,
      };
    }
    return { ok: true, deviceKey: value };
  }

  return { ok: false, error: 'Bark device key is not configured' };
}

function buildBarkMessage(args: {
  channel: BarkChannel;
  eventType: string;
  eventKey: string;
  payload: unknown;
  now: number;
}): { title: string; body: string } {
  const { channel, eventType, eventKey, payload, now } = args;

  const payloadRecord =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  const locale = channel.config.message_locale ?? DEFAULT_NOTIFICATION_LOCALE;

  const defaultBody = defaultMessageForEvent(
    eventType,
    { ...payloadRecord, event: eventKey },
    locale,
  );
  const templateVars: Record<string, unknown> = {
    ...payloadRecord,
    payload: payloadRecord,
    channel: { id: channel.id, name: channel.name },
    event: eventKey,
    event_id: eventKey,
    timestamp: new Date(now).toISOString(),
    message: defaultBody,
    default_message: defaultBody,
  };

  const rendered = channel.config.message_template
    ? renderStringTemplate(channel.config.message_template, templateVars)
    : defaultBody;

  const body = rendered.trim().length > 0 ? rendered.trim() : defaultBody;

  return {
    title: truncate(defaultTitleForEvent(eventType, locale), TITLE_MAX_LENGTH),
    body: truncate(body, BODY_MAX_LENGTH),
  };
}

export async function dispatchBarkPresetRequest(args: {
  env: Record<string, unknown>;
  channel: BarkChannel;
  eventType: string;
  eventKey: string;
  payload: unknown;
  now: number;
}): Promise<ChannelDispatchResult> {
  const { env, channel, eventType, eventKey, payload, now } = args;
  const config = channel.config;

  const resolved = await resolveDeviceKey(env, config);
  if (!resolved.ok) {
    return { status: 'failed', httpStatus: null, error: resolved.error };
  }

  const { title, body } = buildBarkMessage({ channel, eventType, eventKey, payload, now });
  const baseUrl = (config.server_url ?? DEFAULT_SERVER_URL).replace(/\/+$/, '');

  const requestBody: Record<string, unknown> = {
    device_key: resolved.deviceKey,
    title,
    body,
  };
  if (config.level) requestBody.level = config.level;
  if (config.sound) requestBody.sound = config.sound;
  if (config.group) requestBody.group = config.group;
  if (config.icon) requestBody.icon = config.icon;
  if (typeof config.badge === 'number') requestBody.badge = config.badge;
  if (typeof config.is_archive === 'boolean') requestBody.isArchive = config.is_archive;
  if (config.url) requestBody.url = config.url;
  if (config.copy) requestBody.copy = config.copy;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeout_ms ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    const code =
      typeof parsed === 'object' && parsed !== null && 'code' in parsed
        ? (parsed as { code?: unknown }).code
        : undefined;

    if (!response.ok) {
      return {
        status: 'failed',
        httpStatus: response.status,
        error: truncate(redact(text || response.statusText, resolved.deviceKey), 500) || 'Bark request failed',
      };
    }

    // Bark returns {"code":200,...}; tolerate servers that answer 2xx without a body.
    if (typeof code === 'number' && code !== 200) {
      const message =
        typeof parsed === 'object' && parsed !== null && 'message' in parsed
          ? String((parsed as { message?: unknown }).message ?? '')
          : '';
      return {
        status: 'failed',
        httpStatus: response.status,
        error: truncate(message || `Bark returned code ${code}`, 500),
      };
    }

    if (typeof code !== 'number' && text && parsed === null) {
      return {
        status: 'failed',
        httpStatus: response.status,
        error: truncate(redact(text, resolved.deviceKey), 500),
      };
    }

    return { status: 'success', httpStatus: response.status, error: null };
  } catch (err) {
    return {
      status: 'failed',
      httpStatus: null,
      error: truncate(redact(toErrorMessage(err), resolved.deviceKey), 500),
    };
  } finally {
    clearTimeout(timeout);
  }
}
