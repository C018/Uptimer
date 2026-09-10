import type { TelegramChannelConfig } from '@uptimer/db';

import { decryptSecret, encryptSecret, TELEGRAM_BOT_TOKEN_CONTEXT } from './secret-box';

/**
 * Telegram bot tokens stored in D1 are encrypted with the admin token so that
 * a database dump alone does not leak sendable credentials.
 *
 * The ciphertext uses Telegram's own context string, so tokens stored before
 * the shared secret box was extracted keep decrypting unchanged.
 */

export async function encryptTelegramBotToken(
  adminToken: string,
  botToken: string,
): Promise<string> {
  return encryptSecret(adminToken, botToken, TELEGRAM_BOT_TOKEN_CONTEXT);
}

export async function decryptTelegramBotToken(
  adminToken: string,
  encrypted: string,
): Promise<string> {
  return decryptSecret(adminToken, encrypted, TELEGRAM_BOT_TOKEN_CONTEXT);
}

export async function resolveTelegramBotToken(
  config: TelegramChannelConfig,
  resolveSecretRef: (ref: string) => string | undefined,
): Promise<string | null> {
  if (config.bot_token_encrypted) {
    const adminToken = resolveSecretRef('ADMIN_TOKEN');
    if (!adminToken) return null;
    try {
      return await decryptTelegramBotToken(adminToken, config.bot_token_encrypted);
    } catch {
      return null;
    }
  }

  if (config.bot_token_secret_ref) {
    const token = resolveSecretRef(config.bot_token_secret_ref);
    return token && token.trim().length > 0 ? token.trim() : null;
  }

  return null;
}
