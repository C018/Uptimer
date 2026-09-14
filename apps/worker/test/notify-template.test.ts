import { describe, expect, it } from 'vitest';

import {
  defaultMessageForEvent,
  defaultTitleForEvent,
  renderJsonTemplate,
  renderStringTemplate,
} from '../src/notify/template';

describe('notify/template', () => {
  const vars = {
    event: 'monitor.down',
    message: 'API timeout',
    monitor: { id: 9, name: 'API', target: 'https://api.example.com/health' },
    state: { status: 'down', error: 'Timeout after 10000ms', latency_ms: 10000 },
    incident: { title: 'API outage', impact: 'major' },
    update: { message: 'Mitigation applied' },
    maintenance: { title: 'DB maintenance' },
    arr: [{ value: 'first' }, { value: 'second' }],
  } satisfies Record<string, unknown>;

  it('renders string templates with nested paths and array indexes', () => {
    const output = renderStringTemplate(
      '[{{event}}] {{monitor.name}} {{state.status}} {{arr[1].value}} {{missing.field}}',
      vars,
    );
    expect(output).toBe('[monitor.down] API down second ');
  });

  it('supports leading-dot paths and empty message fallback', () => {
    expect(renderStringTemplate('{{ .monitor.name }}', vars)).toBe('API');
    expect(renderStringTemplate('Alert: $MSG', { monitor: vars.monitor })).toBe('Alert: $MSG');
  });

  it('supports legacy-compatible $MSG replacement', () => {
    expect(renderStringTemplate('$MSG', vars)).toBe('API timeout');
    expect(renderStringTemplate('Alert: $MSG', vars)).toBe('Alert: API timeout');
    expect(renderStringTemplate('Alert: {{message}}', vars)).toBe('Alert: API timeout');
  });

  it('blocks prototype-pollution style path expressions', () => {
    expect(renderStringTemplate('{{__proto__.polluted}}', vars)).toBe('');
    expect(renderStringTemplate('{{constructor.prototype}}', vars)).toBe('');
    expect(renderStringTemplate('{{arr[foo]}}', vars)).toBe('');
    expect(renderStringTemplate('{{arr[0}}', vars)).toBe('');
    expect(renderStringTemplate('{{monitor.name[0]}}', vars)).toBe('');
  });

  it('renders JSON templates recursively and respects maxDepth', () => {
    const payload = {
      text: '{{message}}',
      monitor: {
        id: '{{monitor.id}}',
        target: '{{monitor.target}}',
      },
      rows: ['{{arr[0].value}}', '{{arr[1].value}}'],
    };

    expect(renderJsonTemplate(payload, vars)).toEqual({
      text: 'API timeout',
      monitor: {
        id: '9',
        target: 'https://api.example.com/health',
      },
      rows: ['first', 'second'],
    });

    expect(renderJsonTemplate({ deep: { deeper: { value: 'x' } } }, vars, { maxDepth: 1 })).toEqual(
      {
        deep: {
          deeper: null,
        },
      },
    );

    expect(renderJsonTemplate(123, vars)).toBe(123);
  });

  it('builds default English message templates when locale is en', () => {
    expect(defaultMessageForEvent('monitor.down', vars, 'en')).toBe(
      'Monitor DOWN: API\nError: Timeout after 10000ms',
    );
    expect(defaultMessageForEvent('monitor.up', vars, 'en')).toBe('Monitor UP: API');
    expect(
      defaultMessageForEvent(
        'monitor.up',
        {
          ...vars,
          monitor: { ...vars.monitor, display_url: 'https://example.com/status' },
        },
        'en',
      ),
    ).toBe('Monitor UP: API (https://example.com/status)');
    expect(defaultMessageForEvent('incident.created', vars, 'en')).toBe(
      'Incident created: API outage (impact: major)',
    );
    expect(defaultMessageForEvent('incident.updated', vars, 'en')).toContain('Mitigation applied');
    expect(defaultMessageForEvent('incident.resolved', vars, 'en')).toBe(
      'Incident resolved: API outage',
    );
    expect(defaultMessageForEvent('maintenance.started', vars, 'en')).toBe(
      'Maintenance started: DB maintenance',
    );
    expect(defaultMessageForEvent('maintenance.ended', vars, 'en')).toBe(
      'Maintenance ended: DB maintenance',
    );
    expect(defaultMessageForEvent('test.ping', vars, 'en')).toBe('Uptimer test notification');
    expect(defaultMessageForEvent('custom.event', vars, 'en')).toBe('Uptimer event: monitor.down');
    expect(defaultMessageForEvent('custom.event', {}, 'en')).toBe('Uptimer notification');
  });

  it('defaults to Chinese wording and localizes probe errors', () => {
    expect(defaultMessageForEvent('monitor.down', vars)).toBe(
      '监控故障：API\n错误：请求超时（10000ms）',
    );
    expect(defaultMessageForEvent('monitor.up', vars)).toBe('监控恢复：API');
    expect(
      defaultMessageForEvent('monitor.up', {
        ...vars,
        monitor: { ...vars.monitor, display_url: 'https://example.com/status' },
      }),
    ).toBe('监控恢复：API（https://example.com/status）');
    expect(defaultMessageForEvent('incident.created', vars)).toBe(
      '新建故障事件：API outage（影响级别：严重）',
    );
    expect(defaultMessageForEvent('incident.updated', vars)).toContain('Mitigation applied');
    expect(defaultMessageForEvent('incident.resolved', vars)).toBe('故障事件已解决：API outage');
    expect(defaultMessageForEvent('maintenance.started', vars)).toBe('维护已开始：DB maintenance');
    expect(defaultMessageForEvent('maintenance.ended', vars)).toBe('维护已结束：DB maintenance');
    expect(defaultMessageForEvent('test.ping', vars)).toBe('Uptimer 测试通知');
    expect(defaultMessageForEvent('custom.event', vars)).toBe('Uptimer 事件：monitor.down');
    expect(defaultMessageForEvent('custom.event', {})).toBe('Uptimer 通知');
  });

  it('localizes ssl/unknown errors and push titles per locale', () => {
    expect(
      defaultMessageForEvent('monitor.ssl_expiring', {
        ...vars,
        ssl: {
          hostname: 'example.com',
          days_remaining: '3',
          valid_to: '2026-10-01',
          severity: 'expiring',
        },
      }),
    ).toBe('SSL 证书即将到期：example.com（剩余 3 天）\n到期时间：2026-10-01');

    // Unknown runtime errors are passed through untouched.
    expect(
      defaultMessageForEvent('monitor.down', {
        ...vars,
        state: { status: 'down', error: 'fetch failed' },
      }),
    ).toBe('监控故障：API\n错误：fetch failed');

    expect(defaultTitleForEvent('monitor.down')).toBe('监控故障');
    expect(defaultTitleForEvent('monitor.down', 'en')).toBe('Monitor DOWN');
    expect(defaultTitleForEvent('test.ping')).toBe('Uptimer 测试');
    expect(defaultTitleForEvent('test.ping', 'en')).toBe('Uptimer test');
    expect(defaultTitleForEvent('unknown.event')).toBe('Uptimer');
  });

  it('covers every push title in both locales', () => {
    const enTitles: Record<string, string> = {
      'monitor.down': 'Monitor DOWN',
      'monitor.up': 'Monitor UP',
      'monitor.ssl_expiring': 'SSL certificate',
      'incident.created': 'New incident',
      'incident.updated': 'Incident updated',
      'incident.resolved': 'Incident resolved',
      'maintenance.started': 'Maintenance started',
      'maintenance.ended': 'Maintenance ended',
      'test.ping': 'Uptimer test',
      'unknown.event': 'Uptimer',
    };
    const zhTitles: Record<string, string> = {
      'monitor.down': '监控故障',
      'monitor.up': '监控恢复',
      'monitor.ssl_expiring': 'SSL 证书',
      'incident.created': '新建故障事件',
      'incident.updated': '故障事件更新',
      'incident.resolved': '故障事件已解决',
      'maintenance.started': '维护已开始',
      'maintenance.ended': '维护已结束',
      'test.ping': 'Uptimer 测试',
      'unknown.event': 'Uptimer',
    };

    for (const [event, expected] of Object.entries(enTitles)) {
      expect(defaultTitleForEvent(event, 'en')).toBe(expected);
      expect(defaultTitleForEvent(event)).toBe(zhTitles[event]);
    }
  });

  it('renders the SSL expiry wording in both locales', () => {
    expect(
      defaultMessageForEvent(
        'monitor.ssl_expiring',
        {
          ...vars,
          ssl: {
            hostname: 'example.com',
            days_remaining: '3',
            valid_to: '2026-10-01',
            severity: 'expiring',
          },
        },
        'en',
      ),
    ).toBe('SSL certificate expiring soon: example.com (3 days left)\nExpires: 2026-10-01');

    expect(
      defaultMessageForEvent(
        'monitor.ssl_expiring',
        {
          ...vars,
          ssl: {
            hostname: 'example.com',
            days_remaining: '1',
            valid_to: '2026-10-01',
            severity: 'expired',
          },
        },
        'en',
      ),
    ).toBe('SSL certificate EXPIRED: example.com (1 day left)\nExpires: 2026-10-01');

    // Host and expiry clauses fall back to the monitor identity when absent.
    expect(
      defaultMessageForEvent(
        'monitor.ssl_expiring',
        {
          ...vars,
          monitor: { ...vars.monitor, display_url: 'https://example.com/status' },
          ssl: { severity: 'expired' },
        },
        'en',
      ),
    ).toBe('SSL certificate EXPIRED: https://example.com/status');

    expect(
      defaultMessageForEvent(
        'monitor.ssl_expiring',
        { ...vars, monitor: { id: 9, name: 'API', target: 'https://api.example.com/health' }, ssl: { severity: 'expired' } },
        'en',
      ),
    ).toBe('SSL certificate EXPIRED: API');

    expect(
      defaultMessageForEvent(
        'monitor.ssl_expiring',
        { ...vars, monitor: { id: 9, name: 'API', target: 'https://api.example.com/health' }, ssl: { severity: 'expired' } },
      ),
    ).toBe('SSL 证书已过期：API');
  });

  it('omits optional clauses when the runtime values are missing', () => {
    const bare = {
      ...vars,
      monitor: { id: 9, name: 'API', target: 'https://api.example.com/health' },
      state: { status: 'down' },
    };

    expect(defaultMessageForEvent('monitor.down', bare, 'en')).toBe('Monitor DOWN: API');
    expect(defaultMessageForEvent('monitor.down', bare)).toBe('监控故障：API');
    expect(defaultMessageForEvent('incident.updated', { ...vars, update: {} }, 'en')).toBe(
      'Incident updated: API outage',
    );
    expect(defaultMessageForEvent('incident.updated', { ...vars, update: {} })).toBe(
      '故障事件更新：API outage',
    );
  });

  it('falls back when value stringification throws', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(renderStringTemplate('{{circular}}', { circular })).toBe('[object Object]');
    expect(defaultMessageForEvent('custom.event', { event: circular }, 'en')).toBe(
      'Uptimer event: [object Object]',
    );
  });
});
