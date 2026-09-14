import type { NotificationLocale } from '@uptimer/db';

/**
 * Chinese rendering of the probe-layer error messages that end up inside
 * notification bodies (`Error: ...` lines) and inside public status payloads.
 *
 * The English strings are produced by the prober (`monitor/http.ts`,
 * `monitor/http-assertions.ts`, `monitor/ssl.ts`, `monitor/tcp.ts`,
 * `monitor/targets.ts`, `monitor/tls-cert.ts`) and stored as-is. Translating at
 * notification-render time keeps the stored diagnostics stable and makes the
 * Chinese output backwards compatible with already recorded checks.
 *
 * Only known, fully-matched messages are translated; anything unrecognised
 * (raw runtime/network errors such as `fetch failed`) is returned unchanged so
 * no diagnostic detail is ever lost.
 */

type ProbeErrorTranslator = (match: RegExpExecArray) => string;

type ProbeErrorRule = {
  pattern: RegExp;
  zh: string | ProbeErrorTranslator;
};

const ASSERTION_FIELD_LABELS_ZH: Record<string, string> = {
  response_keyword: '响应关键词',
  response_forbidden_keyword: '禁止响应关键词',
};

const RULES: ProbeErrorRule[] = [
  // --- monitor/http.ts ---
  {
    pattern: /^Timeout after (\d+)ms$/,
    zh: (match) => `请求超时（${match[1]}ms）`,
  },
  {
    pattern: /^Response body is not readable for response assertions$/,
    zh: '响应体不可读，无法执行内容断言',
  },
  {
    pattern: /^No attempts executed$/,
    zh: '未执行任何探测尝试',
  },

  // --- monitor/http-assertions.ts ---
  {
    pattern: /^Response body exceeded (\d+) bytes; cannot assert required response regex$/,
    zh: (match) => `响应体超过 ${match[1]} 字节，无法校验必需的响应正则`,
  },
  {
    pattern: /^Response body exceeded (\d+) bytes; cannot assert required keyword$/,
    zh: (match) => `响应体超过 ${match[1]} 字节，无法校验必需的关键词`,
  },
  {
    pattern: /^Response body exceeded (\d+) bytes; cannot assert forbidden response regex absence$/,
    zh: (match) => `响应体超过 ${match[1]} 字节，无法校验禁止的响应正则`,
  },
  {
    pattern: /^Response body exceeded (\d+) bytes; cannot assert forbidden keyword absence$/,
    zh: (match) => `响应体超过 ${match[1]} 字节，无法校验禁止的关键词`,
  },
  {
    pattern: /^Required response regex not matched$/,
    zh: '未匹配到必需的响应正则',
  },
  {
    pattern: /^Response keyword not found$/,
    zh: '未找到响应关键词',
  },
  {
    pattern: /^Forbidden response regex matched$/,
    zh: '命中了禁止的响应正则',
  },
  {
    pattern: /^Forbidden response keyword found$/,
    zh: '命中了禁止的响应关键词',
  },
  {
    pattern: /^Invalid regex for ([\w_]+): (.+)$/,
    zh: (match) => {
      const field = match[1] ?? '';
      const fieldLabel = ASSERTION_FIELD_LABELS_ZH[field] ?? field;
      return `正则表达式无效（${fieldLabel}）：${match[2] ?? ''}`;
    },
  },

  // --- monitor/ssl.ts ---
  {
    pattern: /^Unable to resolve a TLS host\/port from the monitor target$/,
    zh: '无法从监控目标解析出 TLS 主机与端口',
  },
  {
    pattern: /^Certificate expiry date is missing or could not be parsed$/,
    zh: '证书到期时间缺失或无法解析',
  },

  // --- monitor/tls-cert.ts ---
  {
    pattern: /^Connection closed before a certificate was received$/,
    zh: '连接在收到证书前已关闭',
  },
  {
    pattern: /^TLS record too large$/,
    zh: 'TLS 记录过大',
  },
  {
    pattern: /^TLS handshake too large$/,
    zh: 'TLS 握手数据过大',
  },
  {
    pattern: /^TLS handshake message too large$/,
    zh: 'TLS 握手消息过大',
  },
  {
    pattern: /^Failed to parse the TLS certificate$/,
    zh: 'TLS 证书解析失败',
  },
  {
    pattern: /^TLS handshake rejected by peer \(alert (\d+)\)$/,
    zh: (match) => `TLS 握手被对端拒绝（alert ${match[1]}）`,
  },

  // --- monitor/targets.ts ---
  {
    pattern: /^target must be a valid URL$/,
    zh: '监控目标必须是合法的 URL',
  },
  {
    pattern: /^target protocol must be http or https$/,
    zh: '监控目标协议必须是 http 或 https',
  },
  {
    pattern: /^target must include a hostname$/,
    zh: '监控目标必须包含主机名',
  },
  {
    pattern: /^target hostname is not allowed$/,
    zh: '监控目标主机名不被允许',
  },
  {
    pattern: /^target port is invalid$/,
    zh: '监控目标端口无效',
  },
  {
    pattern: /^target port is not allowed$/,
    zh: '监控目标端口不被允许',
  },
  {
    pattern: /^target must be in host:port format \(IPv6: \[addr\]:port\)$/,
    zh: '监控目标必须为 host:port 格式（IPv6 为 [addr]:port）',
  },
  {
    pattern: /^target host is not allowed$/,
    zh: '监控目标主机不被允许',
  },
  {
    pattern: /^target host is required$/,
    zh: '监控目标必须提供主机',
  },
  {
    pattern: /^Invalid IPv4 literal$/,
    zh: 'IPv4 地址格式无效',
  },
  {
    pattern: /^Invalid IPv6 CIDR base$/,
    zh: 'IPv6 CIDR 网段基址无效',
  },

  // --- monitor/tcp.ts ---
  {
    pattern: /^Invalid target format$/,
    zh: '监控目标格式无效',
  },
];

/**
 * Translate a probe error message into the target locale.
 *
 * `en` returns the original string; unknown messages are returned unchanged.
 */
export function localizeProbeError(message: string, locale: NotificationLocale): string {
  if (locale === 'en' || typeof message !== 'string' || message.length === 0) {
    return message;
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return message;
  }

  for (const rule of RULES) {
    const match = rule.pattern.exec(trimmed);
    if (!match) continue;

    return typeof rule.zh === 'string' ? rule.zh : rule.zh(match);
  }

  return message;
}

const IMPACT_LABELS_ZH: Record<string, string> = {
  none: '无影响',
  minor: '轻微',
  major: '严重',
  critical: '危急',
};

/** Translate an incident impact enum value (`minor`/`major`/`critical`). */
export function localizeImpact(impact: string, locale: NotificationLocale): string {
  if (locale === 'en') {
    return impact;
  }

  return IMPACT_LABELS_ZH[impact.toLowerCase()] ?? impact;
}
