import type { Env } from '../env';

/**
 * Deployment-level switch for the Cron certificate scan.
 *
 * Only an explicit `UPTIMER_SSL_CHECK_ENABLED = "1"` (set in wrangler.toml)
 * arms the scan; unset, "0", or any other value keeps it dormant, so local and
 * test environments never open outbound sockets from a scheduler tick.
 */
export function isSslScanEnabled(env: Env): boolean {
  return env.UPTIMER_SSL_CHECK_ENABLED?.trim() === '1';
}

export type SslScanLaunchArgs = {
  env: Env;
  ctx: ExecutionContext;
  now: number;
};

/**
 * Queues one best-effort certificate scan at the tail of a scheduler tick.
 *
 * The scanner module is imported lazily and only when the deployment opted in:
 * it reaches `cloudflare:sockets` through `monitor/tls-cert`, and that module
 * only resolves inside the Workers runtime, so resolving it in a Node test
 * runner would fail the import itself.
 *
 * Rejections are swallowed here on purpose - certificate scanning must never
 * fail the tick that is already doing monitor checks and notifications.
 */
export function launchSslScanPhase({ env, ctx, now }: SslScanLaunchArgs): Promise<void> {
  if (!isSslScanEnabled(env)) return Promise.resolve();

  return import('./ssl-scan')
    .then(({ runSslScanPhase }) => runSslScanPhase({ env, ctx, now }).then(() => undefined))
    .catch((err: unknown) => {
      console.warn('scheduled: ssl scan phase failed', err);
    });
}
