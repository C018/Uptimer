import type { Env } from '../env';

/**
 * Deployment-level switch for the Cron certificate scan.
 *
 * Only an explicit `UPTIMER_SSL_CHECK_ENABLED = "1"` (set in wrangler.toml)
 * arms the scan phase; unset, "0", or any other value keeps it dormant, so
 * local and test environments never open outbound sockets from a tick.
 *
 * The flag lives in its own dependency-free module on purpose: the scheduler
 * reads it *before* importing the scanner, because the scanner pulls in
 * `cloudflare:sockets`, which only resolves inside the Workers runtime.
 */
export function isSslScanEnabled(env: Env): boolean {
  return env.UPTIMER_SSL_CHECK_ENABLED?.trim() === '1';
}
