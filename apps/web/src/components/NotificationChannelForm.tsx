import { useMemo, useState } from 'react';
import type {
  BarkChannelConfig,
  BarkLevel,
  CreateNotificationChannelInput,
  CustomWebhookChannelConfig,
  NotificationChannel,
  NotificationChannelPreset,
  TelegramChannelConfig,
  TelegramParseMode,
  WebhookChannelConfig,
} from '../api/types';
import { useI18n } from '../app/I18nContext';
import {
  Button,
  FIELD_HELP_CLASS,
  FIELD_LABEL_CLASS,
  INPUT_CLASS,
  SELECT_CLASS,
  SegmentedControl,
  Switch,
  TEXTAREA_CLASS,
} from './ui';

interface NotificationChannelFormProps {
  channel?: NotificationChannel | undefined;
  onSubmit: (data: CreateNotificationChannelInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | undefined;
}

const inputClass = INPUT_CLASS;
const selectClass = SELECT_CLASS;
const textareaClass = TEXTAREA_CLASS;
const labelClass = FIELD_LABEL_CLASS;

type NotificationEventType = NonNullable<WebhookChannelConfig['enabled_events']>[number];
type WebhookMethod = NonNullable<CustomWebhookChannelConfig['method']>;
type WebhookPayloadType = NonNullable<CustomWebhookChannelConfig['payload_type']>;
type TelegramParseModeInput = '' | TelegramParseMode;
type TelegramTokenMode = 'token' | 'secret_ref';
type BarkKeyMode = 'key' | 'secret_ref';

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

function isTelegramConfig(
  config: WebhookChannelConfig | undefined,
): config is TelegramChannelConfig {
  return config?.preset === 'telegram';
}

function hasAdvancedTelegramConfig(config: TelegramChannelConfig | undefined): boolean {
  if (!config) return false;

  return Boolean(
    config.bot_token_source === 'secret_ref' ||
    config.bot_token_secret_ref ||
    config.message_thread_id !== undefined ||
    config.timeout_ms !== undefined ||
    config.message_template ||
    (config.enabled_events && config.enabled_events.length > 0) ||
    config.parse_mode ||
    config.disable_notification ||
    config.protect_content,
  );
}

function isBarkConfig(config: WebhookChannelConfig | undefined): config is BarkChannelConfig {
  return config?.preset === 'bark';
}

function hasAdvancedBarkConfig(config: BarkChannelConfig | undefined): boolean {
  if (!config) return false;

  return Boolean(
    config.device_key_secret_ref ||
    config.sound ||
    config.icon ||
    config.badge !== undefined ||
    config.is_archive ||
    config.url ||
    config.copy ||
    config.message_template ||
    (config.enabled_events && config.enabled_events.length > 0) ||
    config.timeout_ms !== undefined,
  );
}

function toMethod(value: string): WebhookMethod {
  switch (value) {
    case 'GET':
    case 'POST':
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
    case 'HEAD':
      return value;
    default:
      return 'POST';
  }
}

function toPayloadType(value: string): WebhookPayloadType {
  switch (value) {
    case 'json':
    case 'param':
    case 'x-www-form-urlencoded':
      return value;
    default:
      return 'json';
  }
}

function toTelegramParseMode(value: string): TelegramParseModeInput {
  switch (value) {
    case 'Markdown':
    case 'MarkdownV2':
    case 'HTML':
      return value;
    default:
      return '';
  }
}

export function NotificationChannelForm({
  channel,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: NotificationChannelFormProps) {
  const { t } = useI18n();
  const initialConfig = channel?.config_json;
  const initialIsTelegram = isTelegramConfig(initialConfig);
  const initialIsBark = isBarkConfig(initialConfig);
  const customConfig =
    initialIsTelegram || initialIsBark
      ? undefined
      : (initialConfig as CustomWebhookChannelConfig | undefined);
  const telegramConfig = initialIsTelegram
    ? (initialConfig as TelegramChannelConfig | undefined)
    : undefined;
  const barkConfig = initialIsBark ? (initialConfig as BarkChannelConfig | undefined) : undefined;

  const [name, setName] = useState(channel?.name ?? '');
  const [preset, setPreset] = useState<NotificationChannelPreset>(
    initialIsTelegram ? 'telegram' : initialIsBark ? 'bark' : 'custom',
  );
  const [url, setUrl] = useState(customConfig?.url ?? '');
  const [method, setMethod] = useState<WebhookMethod>(customConfig?.method ?? 'POST');

  const [timeoutMs, setTimeoutMs] = useState<number>(initialConfig?.timeout_ms ?? 5000);
  const [payloadType, setPayloadType] = useState<WebhookPayloadType>(
    customConfig?.payload_type ?? 'json',
  );

  const [headersJson, setHeadersJson] = useState(safeJsonStringify(customConfig?.headers ?? {}));

  const [messageTemplate, setMessageTemplate] = useState(initialConfig?.message_template ?? '');
  const [payloadTemplateJson, setPayloadTemplateJson] = useState(
    customConfig?.payload_template !== undefined
      ? safeJsonStringify(customConfig.payload_template)
      : '',
  );

  const [enabledEvents, setEnabledEvents] = useState<NotificationEventType[]>(
    initialConfig?.enabled_events ?? [],
  );

  const [signingEnabled, setSigningEnabled] = useState<boolean>(
    customConfig?.signing?.enabled ?? false,
  );
  const [signingSecretRef, setSigningSecretRef] = useState<string>(
    customConfig?.signing?.secret_ref ?? '',
  );

  const [showAdvancedTelegram, setShowAdvancedTelegram] = useState<boolean>(() =>
    hasAdvancedTelegramConfig(telegramConfig),
  );
  const [telegramTokenMode, setTelegramTokenMode] = useState<TelegramTokenMode>(
    telegramConfig?.bot_token_source === 'secret_ref' || telegramConfig?.bot_token_secret_ref
      ? 'secret_ref'
      : 'token',
  );
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramBotTokenSecretRef, setTelegramBotTokenSecretRef] = useState(
    telegramConfig?.bot_token_secret_ref ?? 'UPTIMER_TELEGRAM_BOT_TOKEN',
  );
  const [telegramChatId, setTelegramChatId] = useState(telegramConfig?.chat_id ?? '');
  const [telegramMessageThreadId, setTelegramMessageThreadId] = useState(
    telegramConfig?.message_thread_id !== undefined ? String(telegramConfig.message_thread_id) : '',
  );
  const [telegramParseMode, setTelegramParseMode] = useState<TelegramParseModeInput>(
    telegramConfig?.parse_mode ?? '',
  );
  const [telegramDisableNotification, setTelegramDisableNotification] = useState<boolean>(
    telegramConfig?.disable_notification ?? false,
  );
  const [telegramProtectContent, setTelegramProtectContent] = useState<boolean>(
    telegramConfig?.protect_content ?? false,
  );

  const [showAdvancedBark, setShowAdvancedBark] = useState<boolean>(() =>
    hasAdvancedBarkConfig(barkConfig),
  );
  const [barkKeyMode, setBarkKeyMode] = useState<BarkKeyMode>(
    barkConfig?.device_key_source === 'secret_ref' || barkConfig?.device_key_secret_ref
      ? 'secret_ref'
      : 'key',
  );
  const [barkDeviceKey, setBarkDeviceKey] = useState('');
  const [barkDeviceKeySecretRef, setBarkDeviceKeySecretRef] = useState(
    barkConfig?.device_key_secret_ref ?? 'UPTIMER_BARK_DEVICE_KEY',
  );
  const [barkServerUrl, setBarkServerUrl] = useState(
    barkConfig?.server_url ?? 'https://api.day.app',
  );
  const [barkLevel, setBarkLevel] = useState<BarkLevel>(barkConfig?.level ?? 'active');
  const [barkSound, setBarkSound] = useState(barkConfig?.sound ?? '');
  const [barkGroup, setBarkGroup] = useState(barkConfig?.group ?? '');
  const [barkIcon, setBarkIcon] = useState(barkConfig?.icon ?? '');
  const [barkBadge, setBarkBadge] = useState(
    barkConfig?.badge !== undefined ? String(barkConfig.badge) : '',
  );
  const [barkIsArchive, setBarkIsArchive] = useState<boolean>(barkConfig?.is_archive ?? false);
  const [barkUrl, setBarkUrl] = useState(barkConfig?.url ?? '');
  const [barkCopy, setBarkCopy] = useState(barkConfig?.copy ?? '');

  const headersParse = useMemo(() => {
    if (preset !== 'custom') return { ok: true as const, value: {} as Record<string, string> };

    const trimmed = headersJson.trim();
    if (!trimmed) return { ok: true as const, value: {} as Record<string, string> };

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      return { ok: false as const, error: t('notification_form.error_headers_invalid_json') };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        ok: false as const,
        error: t('notification_form.error_headers_must_object'),
      };
    }

    for (const [k, vv] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof vv !== 'string') {
        return {
          ok: false as const,
          error: t('notification_form.error_header_value_string', { key: k }),
        };
      }
    }

    return { ok: true as const, value: parsed as Record<string, string> };
  }, [headersJson, preset, t]);

  const payloadTemplateParse = useMemo(() => {
    if (preset !== 'custom') {
      return { ok: true as const, value: undefined as unknown };
    }

    const trimmed = payloadTemplateJson.trim();
    if (!trimmed) return { ok: true as const, value: undefined as unknown };

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      return {
        ok: false as const,
        error: t('notification_form.error_payload_template_invalid_json'),
      };
    }

    return { ok: true as const, value: parsed };
  }, [payloadTemplateJson, preset, t]);

  const telegramHasStoredToken = Boolean(
    telegramConfig?.bot_token_configured ||
    telegramConfig?.bot_token_secret_ref ||
    telegramConfig?.bot_token_source,
  );
  const telegramUsesSecretRef = showAdvancedTelegram && telegramTokenMode === 'secret_ref';
  const telegramHasUsableToken = telegramUsesSecretRef
    ? telegramBotTokenSecretRef.trim().length > 0
    : telegramBotToken.trim().length > 0 || Boolean(channel && telegramHasStoredToken);
  const barkHasStoredKey = Boolean(
    barkConfig?.device_key_configured ||
    barkConfig?.device_key_secret_ref ||
    barkConfig?.device_key_source,
  );
  const barkUsesSecretRef = barkKeyMode === 'secret_ref';
  const barkHasUsableKey = barkUsesSecretRef
    ? barkDeviceKeySecretRef.trim().length > 0
    : barkDeviceKey.trim().length > 0 || Boolean(channel && barkHasStoredKey);

  const canSubmit =
    headersParse.ok &&
    payloadTemplateParse.ok &&
    (preset !== 'telegram' || (telegramChatId.trim().length > 0 && telegramHasUsableToken)) &&
    (preset !== 'bark' || barkHasUsableKey);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (preset === 'telegram') {
      const config: TelegramChannelConfig = {
        preset: 'telegram',
        chat_id: telegramChatId.trim(),
      };

      if (telegramUsesSecretRef) {
        config.bot_token_secret_ref = telegramBotTokenSecretRef.trim();
      } else if (telegramBotToken.trim()) {
        config.bot_token = telegramBotToken.trim();
      }
      if (showAdvancedTelegram) {
        if (telegramMessageThreadId.trim()) {
          const parsed = Number(telegramMessageThreadId);
          if (Number.isInteger(parsed) && parsed > 0) {
            config.message_thread_id = parsed;
          }
        }
        if (timeoutMs) {
          config.timeout_ms = timeoutMs;
        }
        if (messageTemplate.trim()) {
          config.message_template = messageTemplate;
        }
        if (enabledEvents.length > 0) {
          config.enabled_events = enabledEvents;
        }
        if (telegramParseMode) {
          config.parse_mode = telegramParseMode;
        }
        if (telegramDisableNotification) {
          config.disable_notification = true;
        }
        if (telegramProtectContent) {
          config.protect_content = true;
        }
      }

      onSubmit({ name, type: 'webhook', config_json: config });
      return;
    }

    if (preset === 'bark') {
      const config: BarkChannelConfig = {
        preset: 'bark',
        server_url: barkServerUrl.trim() || 'https://api.day.app',
        level: barkLevel,
      };

      if (barkUsesSecretRef) {
        config.device_key_secret_ref = barkDeviceKeySecretRef.trim();
      } else if (barkDeviceKey.trim()) {
        config.device_key = barkDeviceKey.trim();
      }

      if (showAdvancedBark) {
        if (barkSound.trim()) config.sound = barkSound.trim();
        if (barkGroup.trim()) config.group = barkGroup.trim();
        if (barkIcon.trim()) config.icon = barkIcon.trim();

        const parsedBadge = Number(barkBadge);
        if (barkBadge.trim() && Number.isInteger(parsedBadge) && parsedBadge >= 0) {
          config.badge = parsedBadge;
        }

        if (barkIsArchive) config.is_archive = true;
        if (barkUrl.trim()) config.url = barkUrl.trim();
        if (barkCopy.trim()) config.copy = barkCopy.trim();

        if (timeoutMs) {
          config.timeout_ms = timeoutMs;
        }
        if (messageTemplate.trim()) {
          config.message_template = messageTemplate;
        }
        if (enabledEvents.length > 0) {
          config.enabled_events = enabledEvents;
        }
      }

      onSubmit({ name, type: 'webhook', config_json: config });
      return;
    }

    const config: CustomWebhookChannelConfig = {
      preset: 'custom',
      url,
      method,
      timeout_ms: timeoutMs,
      payload_type: payloadType,
    };

    if (headersParse.ok && Object.keys(headersParse.value).length > 0) {
      config.headers = headersParse.value;
    }

    if (messageTemplate.trim()) {
      config.message_template = messageTemplate;
    }

    if (payloadTemplateParse.ok && payloadTemplateParse.value !== undefined) {
      config.payload_template = payloadTemplateParse.value;
    }

    if (enabledEvents.length > 0) {
      config.enabled_events = enabledEvents;
    }

    if (signingEnabled) {
      config.signing = { enabled: true, secret_ref: signingSecretRef };
    }

    onSubmit({ name, type: 'webhook', config_json: config });
  };

  const toggleEnabledEvent = (ev: NotificationEventType) => {
    setEnabledEvents((prev) => (prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev]));
  };

  const handlePresetChange = (next: NotificationChannelPreset) => {
    setPreset(next);
    if (!channel && !name.trim()) {
      setName(next === 'telegram' ? 'Telegram' : next === 'bark' ? 'Bark' : 'Webhook');
    }
  };

  const allEvents: NotificationEventType[] = [
    'monitor.down',
    'monitor.up',
    'monitor.ssl_expiring',
    'incident.created',
    'incident.updated',
    'incident.resolved',
    'maintenance.started',
    'maintenance.ended',
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg ui-surface-down dark:ui-surface-down text-sm ui-text-down dark:ui-text-down">
          {error}
        </div>
      )}
      <div>
        <label className={labelClass}>{t('notification_form.name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          required
        />
      </div>

      <div>
        <label className={labelClass}>{t('notification_form.preset')}</label>
        <SegmentedControl<NotificationChannelPreset>
          value={preset}
          onChange={handlePresetChange}
          options={[
            { value: 'custom', label: t('notification_form.preset_custom') },
            { value: 'telegram', label: t('notification_form.preset_telegram') },
            { value: 'bark', label: t('notification_form.preset_bark') },
          ]}
        />
        <div className={FIELD_HELP_CLASS}>
          {preset === 'telegram'
            ? t('notification_form.preset_telegram_help')
            : preset === 'bark'
              ? t('notification_form.preset_bark_help')
              : t('notification_form.preset_custom_help')}
        </div>
      </div>

      {preset === 'custom' && (
        <>
          <div>
            <label className={labelClass}>{t('notification_form.webhook_url')}</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('notification_form.webhook_url_placeholder')}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>{t('notification_form.method')}</label>
            <select
              value={method}
              onChange={(e) => setMethod(toMethod(e.target.value))}
              className={selectClass}
            >
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
              <option value="GET">GET</option>
              <option value="HEAD">HEAD</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>{t('notification_form.payload_type')}</label>
            <select
              value={payloadType}
              onChange={(e) => setPayloadType(toPayloadType(e.target.value))}
              className={selectClass}
            >
              <option value="json">{t('notification_form.payload_type_json')}</option>
              <option value="param">{t('notification_form.payload_type_query')}</option>
              <option value="x-www-form-urlencoded">
                {t('notification_form.payload_type_urlencoded')}
              </option>
            </select>
            <div className={FIELD_HELP_CLASS}>{t('notification_form.payload_type_help')}</div>
          </div>

          <div>
            <label className={labelClass}>{t('notification_form.headers_json')}</label>
            <textarea
              value={headersJson}
              onChange={(e) => setHeadersJson(e.target.value)}
              className={textareaClass}
              rows={4}
              placeholder={t('notification_form.headers_placeholder')}
            />
            {!headersParse.ok && (
              <div className="mt-1 text-xs ui-text-down dark:ui-text-down">
                {headersParse.error}
              </div>
            )}
            <div className={FIELD_HELP_CLASS}>{t('notification_form.headers_help')}</div>
          </div>
        </>
      )}

      {preset === 'telegram' && (
        <>
          {!telegramUsesSecretRef && (
            <div>
              <label className={labelClass}>{t('notification_form.telegram_bot_token')}</label>
              <input
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                className={inputClass}
                placeholder={t('notification_form.telegram_bot_token_placeholder')}
                required={!channel || !telegramHasStoredToken}
              />
              <div className={FIELD_HELP_CLASS}>
                {channel && telegramHasStoredToken
                  ? t('notification_form.telegram_bot_token_keep_help')
                  : t('notification_form.telegram_bot_token_help')}
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>{t('notification_form.telegram_chat_id')}</label>
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              className={inputClass}
              placeholder={t('notification_form.telegram_chat_id_placeholder')}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)]">
            <input
              type="checkbox"
              checked={showAdvancedTelegram}
              onChange={(e) => setShowAdvancedTelegram(e.target.checked)}
            />
            <span>{t('notification_form.advanced_options')}</span>
          </label>

          {showAdvancedTelegram && (
            <div className="space-y-4 border-t ui-border-hairline dark:border-[var(--color-border)] pt-4">
              <div>
                <label className={labelClass}>{t('notification_form.telegram_token_source')}</label>
                <select
                  value={telegramTokenMode}
                  onChange={(e) => setTelegramTokenMode(e.target.value as TelegramTokenMode)}
                  className={selectClass}
                >
                  <option value="token">
                    {t('notification_form.telegram_token_source_encrypted')}
                  </option>
                  <option value="secret_ref">
                    {t('notification_form.telegram_token_source_secret_ref')}
                  </option>
                </select>
                <div className={FIELD_HELP_CLASS}>
                  {t('notification_form.telegram_token_source_help')}
                </div>
              </div>

              {telegramUsesSecretRef ? (
                <div>
                  <label className={labelClass}>
                    {t('notification_form.telegram_bot_token_secret_ref')}
                  </label>
                  <input
                    type="text"
                    value={telegramBotTokenSecretRef}
                    onChange={(e) => setTelegramBotTokenSecretRef(e.target.value)}
                    className={inputClass}
                    placeholder={t('notification_form.telegram_bot_token_secret_ref_placeholder')}
                    required
                  />
                  <div className={FIELD_HELP_CLASS}>
                    {t('notification_form.telegram_bot_token_secret_ref_help')}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>{t('notification_form.telegram_parse_mode')}</label>
                  <select
                    value={telegramParseMode}
                    onChange={(e) => setTelegramParseMode(toTelegramParseMode(e.target.value))}
                    className={selectClass}
                  >
                    <option value="">{t('notification_form.telegram_parse_mode_none')}</option>
                    <option value="MarkdownV2">MarkdownV2</option>
                    <option value="HTML">HTML</option>
                    <option value="Markdown">Markdown</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    {t('notification_form.telegram_message_thread_id_optional')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={telegramMessageThreadId}
                    onChange={(e) => setTelegramMessageThreadId(e.target.value)}
                    className={inputClass}
                    placeholder={t('notification_form.telegram_message_thread_id_placeholder')}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>{t('notification_form.timeout_ms')}</label>
                <input
                  type="number"
                  min={1}
                  max={60000}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  {t('notification_form.message_template_optional')}
                </label>
                <textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  className={textareaClass}
                  rows={3}
                  placeholder={t('notification_form.message_template_placeholder')}
                />
                <div className={FIELD_HELP_CLASS}>
                  {t('notification_form.message_template_help')}
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  {t('notification_form.enabled_events_optional')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allEvents.map((ev) => (
                    <label
                      key={ev}
                      className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)]"
                    >
                      <input
                        type="checkbox"
                        checked={enabledEvents.includes(ev)}
                        onChange={() => toggleEnabledEvent(ev)}
                      />
                      <span>{ev}</span>
                    </label>
                  ))}
                </div>
                <div className={FIELD_HELP_CLASS}>{t('notification_form.enabled_events_help')}</div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    checked={telegramDisableNotification}
                    onChange={(e) => setTelegramDisableNotification(e.target.checked)}
                  />
                  <span>{t('notification_form.telegram_disable_notification')}</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    checked={telegramProtectContent}
                    onChange={(e) => setTelegramProtectContent(e.target.checked)}
                  />
                  <span>{t('notification_form.telegram_protect_content')}</span>
                </label>
              </div>
            </div>
          )}
        </>
      )}

      {preset === 'bark' && (
        <>
          <div>
            <label className={labelClass}>{t('notification_form.bark_key_source')}</label>
            <SegmentedControl<BarkKeyMode>
              value={barkKeyMode}
              onChange={setBarkKeyMode}
              options={[
                { value: 'key', label: t('notification_form.bark_key_source_encrypted') },
                { value: 'secret_ref', label: t('notification_form.bark_key_source_secret_ref') },
              ]}
            />
            <div className={FIELD_HELP_CLASS}>{t('notification_form.bark_key_source_help')}</div>
          </div>

          {barkUsesSecretRef ? (
            <div>
              <label className={labelClass}>{t('notification_form.bark_device_key_secret_ref')}</label>
              <input
                type="text"
                value={barkDeviceKeySecretRef}
                onChange={(e) => setBarkDeviceKeySecretRef(e.target.value)}
                className={inputClass}
                placeholder="UPTIMER_BARK_DEVICE_KEY"
                required
              />
              <div className={FIELD_HELP_CLASS}>
                {t('notification_form.bark_device_key_secret_ref_help')}
              </div>
            </div>
          ) : (
            <div>
              <label className={labelClass}>{t('notification_form.bark_device_key')}</label>
              <input
                type="password"
                value={barkDeviceKey}
                onChange={(e) => setBarkDeviceKey(e.target.value)}
                className={inputClass}
                placeholder={t('notification_form.bark_device_key_placeholder')}
                autoComplete="off"
              />
              <div className={FIELD_HELP_CLASS}>
                {channel && barkHasStoredKey
                  ? t('notification_form.bark_device_key_keep_help')
                  : t('notification_form.bark_device_key_help')}
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>{t('notification_form.bark_level')}</label>
            <SegmentedControl<BarkLevel>
              value={barkLevel}
              onChange={setBarkLevel}
              options={[
                { value: 'active', label: t('notification_form.bark_level_active') },
                { value: 'timeSensitive', label: t('notification_form.bark_level_time_sensitive') },
                { value: 'passive', label: t('notification_form.bark_level_passive') },
                { value: 'critical', label: t('notification_form.bark_level_critical') },
              ]}
            />
            <div className={FIELD_HELP_CLASS}>{t('notification_form.bark_level_help')}</div>
          </div>

          <div>
            <label className={labelClass}>{t('notification_form.bark_server_url')}</label>
            <input
              type="url"
              value={barkServerUrl}
              onChange={(e) => setBarkServerUrl(e.target.value)}
              className={inputClass}
              placeholder="https://api.day.app"
            />
            <div className={FIELD_HELP_CLASS}>{t('notification_form.bark_server_url_help')}</div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border ui-border-hairline bg-[var(--color-bg)] px-3 py-2.5 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)]">
            <span className="text-sm font-medium text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)]">
              {t('notification_form.advanced_options')}
            </span>
            <Switch
              checked={showAdvancedBark}
              onChange={setShowAdvancedBark}
              label={t('notification_form.advanced_options')}
            />
          </div>

          {showAdvancedBark && (
            <div className="space-y-4 border-t ui-border-hairline pt-4 dark:border-[var(--color-border)]">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>{t('notification_form.bark_sound')}</label>
                  <input
                    type="text"
                    value={barkSound}
                    onChange={(e) => setBarkSound(e.target.value)}
                    className={inputClass}
                    placeholder={t('notification_form.bark_sound_placeholder')}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('notification_form.bark_group')}</label>
                  <input
                    type="text"
                    value={barkGroup}
                    onChange={(e) => setBarkGroup(e.target.value)}
                    className={inputClass}
                    placeholder={t('notification_form.bark_group_placeholder')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>{t('notification_form.bark_icon')}</label>
                  <input
                    type="url"
                    value={barkIcon}
                    onChange={(e) => setBarkIcon(e.target.value)}
                    className={inputClass}
                    placeholder="https://example.com/icon.png"
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('notification_form.bark_badge')}</label>
                  <input
                    type="number"
                    min={0}
                    value={barkBadge}
                    onChange={(e) => setBarkBadge(e.target.value)}
                    className={inputClass}
                    placeholder={t('notification_form.bark_badge_placeholder')}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>{t('notification_form.bark_url')}</label>
                <input
                  type="url"
                  value={barkUrl}
                  onChange={(e) => setBarkUrl(e.target.value)}
                  className={inputClass}
                  placeholder={t('notification_form.bark_url_placeholder')}
                />
                <div className={FIELD_HELP_CLASS}>{t('notification_form.bark_url_help')}</div>
              </div>

              <div>
                <label className={labelClass}>{t('notification_form.bark_copy')}</label>
                <input
                  type="text"
                  value={barkCopy}
                  onChange={(e) => setBarkCopy(e.target.value)}
                  className={inputClass}
                  placeholder={t('notification_form.bark_copy_placeholder')}
                />
                <div className={FIELD_HELP_CLASS}>{t('notification_form.bark_copy_help')}</div>
              </div>

              <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  checked={barkIsArchive}
                  onChange={(e) => setBarkIsArchive(e.target.checked)}
                />
                <span>{t('notification_form.bark_is_archive')}</span>
              </label>

              <div>
                <label className={labelClass}>{t('notification_form.timeout_ms')}</label>
                <input
                  type="number"
                  min={1}
                  max={60000}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  {t('notification_form.message_template_optional')}
                </label>
                <textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  className={textareaClass}
                  rows={3}
                  placeholder={t('notification_form.message_template_placeholder')}
                />
                <div className={FIELD_HELP_CLASS}>
                  {t('notification_form.message_template_help')}
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  {t('notification_form.enabled_events_optional')}
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {allEvents.map((ev) => (
                    <label
                      key={ev}
                      className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)]"
                    >
                      <input
                        type="checkbox"
                        checked={enabledEvents.includes(ev)}
                        onChange={() => toggleEnabledEvent(ev)}
                      />
                      <span>{ev}</span>
                    </label>
                  ))}
                </div>
                <div className={FIELD_HELP_CLASS}>
                  {t('notification_form.enabled_events_help')}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {preset === 'custom' && (
        <>
          <div>
            <label className={labelClass}>{t('notification_form.timeout_ms')}</label>
            <input
              type="number"
              min={1}
              max={60000}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>{t('notification_form.message_template_optional')}</label>
            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className={textareaClass}
              rows={3}
              placeholder={t('notification_form.message_template_placeholder')}
            />
            <div className={FIELD_HELP_CLASS}>{t('notification_form.message_template_help')}</div>
          </div>

          <div>
            <label className={labelClass}>{t('notification_form.payload_template_optional')}</label>
            <textarea
              value={payloadTemplateJson}
              onChange={(e) => setPayloadTemplateJson(e.target.value)}
              className={textareaClass}
              rows={8}
              placeholder={
                payloadType === 'json'
                  ? t('notification_form.payload_template_placeholder_json')
                  : t('notification_form.payload_template_placeholder_flat')
              }
            />
            {!payloadTemplateParse.ok && (
              <div className="mt-1 text-xs ui-text-down dark:ui-text-down">
                {payloadTemplateParse.error}
              </div>
            )}
            <div className={FIELD_HELP_CLASS}>{t('notification_form.payload_template_help')}</div>
          </div>

          <div>
            <label className={labelClass}>{t('notification_form.enabled_events_optional')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {allEvents.map((ev) => (
                <label
                  key={ev}
                  className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)]"
                >
                  <input
                    type="checkbox"
                    checked={enabledEvents.includes(ev)}
                    onChange={() => toggleEnabledEvent(ev)}
                  />
                  <span>{ev}</span>
                </label>
              ))}
            </div>
            <div className={FIELD_HELP_CLASS}>{t('notification_form.enabled_events_help')}</div>
          </div>
        </>
      )}

      {preset === 'custom' && (
        <div className="border-t ui-border-hairline dark:border-[var(--color-border)] pt-4">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)]">
            <input
              type="checkbox"
              checked={signingEnabled}
              onChange={(e) => setSigningEnabled(e.target.checked)}
            />
            <span>{t('notification_form.signing_enable')}</span>
          </label>
          {signingEnabled && (
            <div className="mt-3">
              <label className={labelClass}>{t('notification_form.signing_secret_ref')}</label>
              <input
                type="text"
                value={signingSecretRef}
                onChange={(e) => setSigningSecretRef(e.target.value)}
                className={inputClass}
                placeholder={t('notification_form.signing_secret_ref_placeholder')}
                required
              />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading || !canSubmit} className="flex-1">
          {isLoading ? t('common.saving') : channel ? t('common.update') : t('common.create')}
        </Button>
      </div>
    </form>
  );
}
