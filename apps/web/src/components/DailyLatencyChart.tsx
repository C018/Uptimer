import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

import type { MonitorAnalyticsDayPoint } from '../api/types';
import { useI18n } from '../app/I18nContext';
import { useTheme } from '../app/ThemeContext';
import { chartPalette } from '../theme/applePalette';
import { suggestLatencyAxisCeiling } from '../utils/latencyScale';

interface DailyLatencyChartProps {
  points: MonitorAnalyticsDayPoint[];
  height?: number;
}

function formatDay(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString([], { month: '2-digit', day: '2-digit' });
}

export function DailyLatencyChart({ points, height = 220 }: DailyLatencyChartProps) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const rawData = points
    .filter(
      (p): p is MonitorAnalyticsDayPoint & { p95_latency_ms: number } =>
        typeof p.p95_latency_ms === 'number',
    )
    .map((p) => ({
      day: p.day_start_at,
      p95_latency_ms: p.p95_latency_ms,
      p50_latency_ms: p.p50_latency_ms,
    }));
  const axisCeiling = suggestLatencyAxisCeiling(
    rawData
      .flatMap((point) => [point.p95_latency_ms, point.p50_latency_ms])
      .filter((value): value is number => typeof value === 'number'),
  );
  const data = rawData.map((point) => ({
    ...point,
    p95_latency_plot:
      axisCeiling !== null && point.p95_latency_ms > axisCeiling ? null : point.p95_latency_ms,
    p50_latency_plot:
      axisCeiling !== null &&
      typeof point.p50_latency_ms === 'number' &&
      point.p50_latency_ms > axisCeiling
        ? null
        : point.p50_latency_ms,
  }));
  const yAxisDomainProps =
    axisCeiling === null
      ? {}
      : { domain: [0, axisCeiling] as [number, number], allowDataOverflow: true };

  if (rawData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
        {t('common.no_latency_data')}
      </div>
    );
  }

  const palette = chartPalette(isDark);
  const axisColor = palette.axis;
  const p95Color = palette.accent;
  const p50Color = palette.lineSecondary;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <XAxis
          dataKey="day"
          tickFormatter={formatDay}
          tick={{ fontSize: 12, fill: axisColor }}
          stroke={axisColor}
        />
        <YAxis
          tick={{ fontSize: 12, fill: axisColor }}
          stroke={axisColor}
          {...yAxisDomainProps}
          tickFormatter={(v) => `${v}ms`}
        />
        <Tooltip
          labelFormatter={(v) => new Date(Number(v) * 1000).toLocaleDateString()}
          formatter={(_value: number, name, item: unknown) => {
            const payload = (
              item as { payload?: { p50_latency_ms?: number; p95_latency_ms?: number } }
            ).payload;
            const rawLatency =
              name === 'p50_latency_plot' ? payload?.p50_latency_ms : payload?.p95_latency_ms;
            return [
              typeof rawLatency === 'number' ? `${rawLatency}ms` : '-',
              name === 'p50_latency_plot' ? 'P50' : 'P95',
            ];
          }}
          contentStyle={{
            backgroundColor: palette.tooltipBg,
            borderColor: palette.tooltipBorder,
            borderRadius: '0.5rem',
            color: palette.tooltipText,
          }}
        />
        <Line
          type="monotone"
          dataKey="p95_latency_plot"
          stroke={p95Color}
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="p50_latency_plot"
          stroke={p50Color}
          strokeWidth={1}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
