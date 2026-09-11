import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../src/env';
import { publicRoutes } from '../src/routes/public';
import { createFakeD1Database, type FakeD1QueryHandler } from './helpers/fake-d1';

type CacheStore = Map<string, Response>;

function installCacheMock(store: CacheStore) {
  const open = vi.fn(async () => ({
    async match(request: Request) {
      const cached = store.get(request.url);
      return cached ? cached.clone() : undefined;
    },
    async put(request: Request, response: Response) {
      store.set(request.url, response.clone());
    },
  }));

  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { open },
  });
}

const NOW = 1_800_000_000;
const DAY = 86_400;

type SslRowInput = {
  monitorId: number;
  warnDays?: number | null;
  status?: string | null;
  storedDaysRemaining?: number | null;
  validTo?: number | null;
  issuer?: string | null;
  lastError?: string | null;
  /** Pass null to simulate a monitor without any certificate snapshot. */
  checkedAt?: number | null;
};

/**
 * Drizzle maps raw rows positionally, so the fake D1 handler must return the
 * values in the exact order of the select list: monitorId, warnDays, status,
 * storedDaysRemaining, validTo, issuer, lastError, checkedAt.
 */
function makeRow(input: SslRowInput): unknown[] {
  const checkedAt = input.checkedAt === undefined ? NOW - 60 : input.checkedAt;
  if (checkedAt === null) {
    return [input.monitorId, input.warnDays ?? 14, null, null, null, null, null, null];
  }

  return [
    input.monitorId,
    input.warnDays ?? 14,
    input.status ?? 'valid',
    input.storedDaysRemaining ?? null,
    input.validTo ?? null,
    input.issuer ?? null,
    input.lastError ?? null,
    checkedAt,
  ];
}

async function requestSslSummary(rows: unknown[][]) {
  const handlers: FakeD1QueryHandler[] = [
    {
      match: (sql) => sql.includes('monitor_ssl_state') && sql.includes('left join'),
      all: () => rows,
    },
  ];
  const env = {
    DB: createFakeD1Database(handlers),
    ADMIN_TOKEN: 'test-admin-token',
  } as unknown as Env;
  const res = await publicRoutes.fetch(new Request('https://status.example.com/ssl-summary'), env, {
    waitUntil: vi.fn(),
  } as unknown as ExecutionContext);
  return {
    res,
    body: (await res.json()) as {
      generated_at: number;
      monitors: Array<Record<string, unknown>>;
    },
  };
}

describe('public ssl summary route', () => {
  const originalCaches = (globalThis as { caches?: unknown }).caches;

  beforeEach(() => {
    installCacheMock(new Map());
    vi.useFakeTimers();
    vi.setSystemTime(NOW * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalCaches === undefined) {
      delete (globalThis as { caches?: unknown }).caches;
    } else {
      Object.defineProperty(globalThis, 'caches', {
        configurable: true,
        value: originalCaches,
      });
    }
    vi.restoreAllMocks();
  });

  it('exposes certificate days remaining per monitor and recomputes from notAfter', async () => {
    const { res, body } = await requestSslSummary([
      makeRow({ monitorId: 1, validTo: NOW + 40 * DAY, issuer: 'CA-A' }),
      makeRow({ monitorId: 2, validTo: NOW + 10 * DAY, warnDays: 14, issuer: 'CA-B' }),
      makeRow({ monitorId: 3, validTo: NOW - 2 * DAY, issuer: 'CA-C' }),
      makeRow({ monitorId: 4, lastError: 'tls handshake failed', validTo: NOW + 90 * DAY }),
      makeRow({ monitorId: 5, checkedAt: null }),
    ]);

    expect(res.status).toBe(200);
    expect(body.generated_at).toBe(NOW);
    expect(body.monitors.map((row) => row.monitor_id)).toEqual([1, 2, 3, 4, 5]);
    expect(body.monitors.map((row) => row.status)).toEqual([
      'ok',
      'expiring',
      'expired',
      'error',
      'unknown',
    ]);
    expect(body.monitors.map((row) => row.days_remaining)).toEqual([40, 10, -2, null, null]);
    expect(body.monitors[0]).toMatchObject({ issuer: 'CA-A', warn_days: 14 });
  });

  it('falls back to the stored days remaining when notAfter is missing', async () => {
    const { body } = await requestSslSummary([
      makeRow({ monitorId: 7, validTo: null, storedDaysRemaining: 5, warnDays: 14 }),
    ]);

    expect(body.monitors[0]).toMatchObject({
      monitor_id: 7,
      status: 'expiring',
      days_remaining: 5,
    });
  });

  it('reports an empty list when no monitor has SSL checking enabled', async () => {
    const { res, body } = await requestSslSummary([]);

    expect(res.status).toBe(200);
    expect(body.monitors).toEqual([]);
  });
});
