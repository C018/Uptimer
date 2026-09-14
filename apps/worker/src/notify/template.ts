import {
  DEFAULT_NOTIFICATION_LOCALE,
  type NotificationEventType,
  type NotificationLocale,
} from '@uptimer/db';

import { localizeImpact, localizeProbeError } from './probe-error-i18n';

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

type PathToken = { type: 'prop'; key: string } | { type: 'index'; index: number };

function parsePath(path: string): PathToken[] | null {
  const trimmed = path.trim();
  if (!trimmed) return null;

  const tokens: PathToken[] = [];
  let i = 0;

  while (i < trimmed.length) {
    // Skip leading dots.
    if (trimmed[i] === '.') {
      i++;
      continue;
    }

    // Parse property name.
    const start = i;
    while (i < trimmed.length && trimmed[i] !== '.' && trimmed[i] !== '[') {
      i++;
    }
    if (i > start) {
      const key = trimmed.slice(start, i);
      if (!key || FORBIDDEN_KEYS.has(key)) return null;
      tokens.push({ type: 'prop', key });
    }

    // Parse optional [index] segments.
    while (i < trimmed.length && trimmed[i] === '[') {
      i++; // consume '['
      const idxStart = i;
      while (i < trimmed.length && trimmed[i] !== ']') {
        i++;
      }
      if (i >= trimmed.length) return null;
      const raw = trimmed.slice(idxStart, i).trim();
      i++; // consume ']'
      if (!/^\d+$/.test(raw)) return null;
      const index = Number(raw);
      if (!Number.isInteger(index)) return null;
      tokens.push({ type: 'index', index });
    }

    if (i < trimmed.length && trimmed[i] === '.') {
      i++;
    }
  }

  return tokens.length > 0 ? tokens : null;
}

function resolvePathValue(vars: Record<string, unknown>, path: string): unknown {
  const tokens = parsePath(path);
  if (!tokens) return undefined;

  let cur: unknown = vars;
  for (const t of tokens) {
    if (cur === null || cur === undefined) return undefined;

    if (t.type === 'index') {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[t.index];
      continue;
    }

    if (typeof cur !== 'object') return undefined;
    const rec = cur as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(rec, t.key)) return undefined;
    cur = rec[t.key];
  }

  return cur;
}

function toTemplateString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function renderStringTemplate(template: string, vars: Record<string, unknown>): string {
  const msg = typeof vars.message === 'string' ? vars.message : '';

  // Legacy compatibility: replace $MSG.
  if (template === '$MSG') return msg;
  const withMsg = msg ? template.split('$MSG').join(msg) : template;

  return withMsg.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_m, expr: string) => {
    const value = resolvePathValue(vars, expr);
    return toTemplateString(value);
  });
}

export function renderJsonTemplate(
  value: unknown,
  vars: Record<string, unknown>,
  opts: { maxDepth?: number } = {},
): unknown {
  const maxDepth = opts.maxDepth ?? 32;

  function inner(v: unknown, depth: number): unknown {
    if (depth > maxDepth) return null;

    if (typeof v === 'string') {
      return renderStringTemplate(v, vars);
    }
    if (Array.isArray(v)) {
      return v.map((it) => inner(it, depth + 1));
    }
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, vv] of Object.entries(v as Record<string, unknown>)) {
        out[k] = inner(vv, depth + 1);
      }
      return out;
    }

    return v;
  }

  return inner(value, 0);
}

function asString(vars: Record<string, unknown>, path: string): string {
  const v = resolvePathValue(vars, path);
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Default notification body for a built-in event type.
 *
 * `locale` selects the wording (`zh-CN` by default, `en` keeps the legacy
 * English wording). Probe error text embedded in the body is localized too.
 */
export function defaultMessageForEvent(
  eventType: NotificationEventType | string,
  vars: Record<string, unknown>,
  locale: NotificationLocale = DEFAULT_NOTIFICATION_LOCALE,
): string {
  return locale === 'en'
    ? englishMessageForEvent(eventType, vars)
    : chineseMessageForEvent(eventType, vars);
}

/** Legacy English wording, kept byte-for-byte identical to the pre-i18n output. */
function englishMessageForEvent(
  eventType: NotificationEventType | string,
  vars: Record<string, unknown>,
): string {
  switch (eventType) {
    case 'monitor.down': {
      const name = asString(vars, 'monitor.name');
      const displayUrl = asString(vars, 'monitor.display_url');
      const err = asString(vars, 'state.error');
      return `Monitor DOWN: ${name}${displayUrl ? ` (${displayUrl})` : ''}${err ? `\nError: ${err}` : ''}`;
    }
    case 'monitor.up': {
      const name = asString(vars, 'monitor.name');
      const displayUrl = asString(vars, 'monitor.display_url');
      return `Monitor UP: ${name}${displayUrl ? ` (${displayUrl})` : ''}`;
    }
    case 'monitor.ssl_expiring': {
      const name = asString(vars, 'monitor.name');
      const host = asString(vars, 'ssl.hostname') || asString(vars, 'monitor.display_url') || name;
      const days = asString(vars, 'ssl.days_remaining');
      const validTo = asString(vars, 'ssl.valid_to');
      const expired = asString(vars, 'ssl.severity') === 'expired';
      const headline = expired ? 'SSL certificate EXPIRED' : 'SSL certificate expiring soon';
      const daysText = days ? ` (${days} ${days === '1' ? 'day' : 'days'} left)` : '';
      return `${headline}: ${host}${daysText}${validTo ? `\nExpires: ${validTo}` : ''}`;
    }
    case 'incident.created': {
      const title = asString(vars, 'incident.title');
      const impact = asString(vars, 'incident.impact');
      return `Incident created: ${title}${impact ? ` (impact: ${impact})` : ''}`;
    }
    case 'incident.updated': {
      const title = asString(vars, 'incident.title');
      const msg = asString(vars, 'update.message');
      return `Incident updated: ${title}${msg ? `\n${msg}` : ''}`;
    }
    case 'incident.resolved': {
      const title = asString(vars, 'incident.title');
      return `Incident resolved: ${title}`;
    }
    case 'maintenance.started': {
      const title = asString(vars, 'maintenance.title');
      return `Maintenance started: ${title}`;
    }
    case 'maintenance.ended': {
      const title = asString(vars, 'maintenance.title');
      return `Maintenance ended: ${title}`;
    }
    case 'test.ping': {
      return 'Uptimer test notification';
    }
    default: {
      const ev = asString(vars, 'event');
      return ev ? `Uptimer event: ${ev}` : 'Uptimer notification';
    }
  }
}

/** Chinese wording (default). */
function chineseMessageForEvent(
  eventType: NotificationEventType | string,
  vars: Record<string, unknown>,
): string {
  switch (eventType) {
    case 'monitor.down': {
      const name = asString(vars, 'monitor.name');
      const displayUrl = asString(vars, 'monitor.display_url');
      const err = localizeProbeError(asString(vars, 'state.error'), 'zh-CN');
      return `监控故障：${name}${displayUrl ? `（${displayUrl}）` : ''}${err ? `\n错误：${err}` : ''}`;
    }
    case 'monitor.up': {
      const name = asString(vars, 'monitor.name');
      const displayUrl = asString(vars, 'monitor.display_url');
      return `监控恢复：${name}${displayUrl ? `（${displayUrl}）` : ''}`;
    }
    case 'monitor.ssl_expiring': {
      const name = asString(vars, 'monitor.name');
      const host = asString(vars, 'ssl.hostname') || asString(vars, 'monitor.display_url') || name;
      const days = asString(vars, 'ssl.days_remaining');
      const validTo = asString(vars, 'ssl.valid_to');
      const expired = asString(vars, 'ssl.severity') === 'expired';
      const headline = expired ? 'SSL 证书已过期' : 'SSL 证书即将到期';
      const daysText = days ? `（剩余 ${days} 天）` : '';
      return `${headline}：${host}${daysText}${validTo ? `\n到期时间：${validTo}` : ''}`;
    }
    case 'incident.created': {
      const title = asString(vars, 'incident.title');
      const impact = asString(vars, 'incident.impact');
      const impactText = impact ? `（影响级别：${localizeImpact(impact, 'zh-CN')}）` : '';
      return `新建故障事件：${title}${impactText}`;
    }
    case 'incident.updated': {
      const title = asString(vars, 'incident.title');
      const msg = asString(vars, 'update.message');
      return `故障事件更新：${title}${msg ? `\n${msg}` : ''}`;
    }
    case 'incident.resolved': {
      const title = asString(vars, 'incident.title');
      return `故障事件已解决：${title}`;
    }
    case 'maintenance.started': {
      const title = asString(vars, 'maintenance.title');
      return `维护已开始：${title}`;
    }
    case 'maintenance.ended': {
      const title = asString(vars, 'maintenance.title');
      return `维护已结束：${title}`;
    }
    case 'test.ping': {
      return 'Uptimer 测试通知';
    }
    default: {
      const ev = asString(vars, 'event');
      return ev ? `Uptimer 事件：${ev}` : 'Uptimer 通知';
    }
  }
}

/**
 * Short push title for channels that need one (e.g. Bark).
 *
 * `locale` selects the wording (`zh-CN` by default, `en` keeps the legacy
 * English wording).
 */
export function defaultTitleForEvent(
  eventType: NotificationEventType | string,
  locale: NotificationLocale = DEFAULT_NOTIFICATION_LOCALE,
): string {
  return locale === 'en' ? englishTitleForEvent(eventType) : chineseTitleForEvent(eventType);
}

function englishTitleForEvent(eventType: NotificationEventType | string): string {
  switch (eventType) {
    case 'monitor.down':
      return 'Monitor DOWN';
    case 'monitor.up':
      return 'Monitor UP';
    case 'monitor.ssl_expiring':
      return 'SSL certificate';
    case 'incident.created':
      return 'New incident';
    case 'incident.updated':
      return 'Incident updated';
    case 'incident.resolved':
      return 'Incident resolved';
    case 'maintenance.started':
      return 'Maintenance started';
    case 'maintenance.ended':
      return 'Maintenance ended';
    case 'test.ping':
      return 'Uptimer test';
    default:
      return 'Uptimer';
  }
}

function chineseTitleForEvent(eventType: NotificationEventType | string): string {
  switch (eventType) {
    case 'monitor.down':
      return '监控故障';
    case 'monitor.up':
      return '监控恢复';
    case 'monitor.ssl_expiring':
      return 'SSL 证书';
    case 'incident.created':
      return '新建故障事件';
    case 'incident.updated':
      return '故障事件更新';
    case 'incident.resolved':
      return '故障事件已解决';
    case 'maintenance.started':
      return '维护已开始';
    case 'maintenance.ended':
      return '维护已结束';
    case 'test.ping':
      return 'Uptimer 测试';
    default:
      return 'Uptimer';
  }
}
