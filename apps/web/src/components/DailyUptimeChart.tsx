import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

import type { MonitorAnalyticsDayPoint } from '../api/types';
import { useI18n } from '../app/I18nContext';
import { useTheme } from '../app/ThemeContext';
import { chartPalette, unknownFill } from '../theme/applePalette';

interface DailyUptimeChartProps {
  points: MonitorAnalyticsDayPoint[];
  height?: number;
}

function formatDay(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString([], { month: '2-digit', day: '2-digit' });
}

export function DailyUptimeChart({ points, height = 220 }: DailyUptimeChartProps) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const data = points.map((p) => ({
    day: p.day_start_at,
    uptime_pct: Number(p.uptime_pct.toFixed(3)),
    unknown_pct: p.total_sec === 0 ? 0 : Number(((p.unknown_sec / p.total_sec) * 100).toFixed(3)),
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
        {t('common.no_data')}
      </div>
    );
  }

  const palette = chartPalette(isDark);
  const axisColor = palette.axis;
  const uptimeColor = palette.linePrimary;
  const unknownColor = unknownFill(isDark);

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
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          labelFormatter={(v) => new Date(Number(v) * 1000).toLocaleDateString()}
          formatter={(v: number, name) => [
            `${v}%`,
            name === 'uptime_pct' ? t('uptime.uptime') : t('uptime.unknown'),
          ]}
          contentStyle={{
            backgroundColor: palette.tooltipBg,
            borderColor: palette.tooltipBorder,
            borderRadius: '0.5rem',
            color: palette.tooltipText,
          }}
        />
        <Line
          type="monotone"
          dataKey="uptime_pct"
          stroke={uptimeColor}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="unknown_pct"
          stroke={unknownColor}
          strokeWidth={1}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
