import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

type Props = {
  data: any[];
  dataKey: string;
  colors?: string[];
  height?: number;
  ariaLabel?: string;
  showLegend?: boolean;
  labelFormatter?: (name: string, percent: number) => string;
};

export default function SharedPieChart({
  data,
  dataKey,
  colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'],
  height = 300,
  ariaLabel,
  showLegend = true,
  labelFormatter,
}: Props) {
  const total = Array.isArray(data) ? data.reduce((s, d) => s + Number(d[dataKey] || 0), 0) : 0;

  if (!data || data.length === 0 || total === 0) {
    return <div className="text-sm text-slate-500 p-6 rounded-lg bg-[var(--color-light-section)]/60">No data to display</div>;
  }

  const thresholdPct = 5; // group slices smaller than this into "Other"
  const grouped: any[] = [];
  let otherCount = 0;

  data.forEach((d) => {
    const val = Number(d[dataKey] || 0);
    const pct = (val / total) * 100;
    if (pct >= thresholdPct) {
      grouped.push({ name: d.name, value: val });
    } else {
      otherCount += val;
    }
  });

  if (otherCount > 0) {
    grouped.push({ name: 'Other', value: otherCount });
  }

  const outerRadius = Math.max(60, Math.min(120, Math.floor(height / 3)));

  return (
    <div role="img" aria-label={ariaLabel || 'pie chart'}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={grouped}
            cx="50%"
            cy="50%"
            outerRadius={outerRadius}
            labelLine={false}
            label={({ name, percent }: any) => (labelFormatter ? labelFormatter(name, percent) : `${name}: ${Math.round((percent ?? 0) * 100)}%`)}
            dataKey="value"
          >
            {grouped.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: any) => [value, 'Count']} contentStyle={{ borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>

      {showLegend && (
        <div className="mt-3 flex flex-wrap gap-3">
          {grouped.map((g, i) => (
            <div key={`legend-${i}`} className="flex items-center gap-2 text-sm text-slate-700">
              <span style={{ width: 12, height: 12, background: colors[i % colors.length], display: 'inline-block', borderRadius: 3 }} />
              <span>{g.name}</span>
              <span className="text-xs text-slate-500">{`(${g.value})`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
