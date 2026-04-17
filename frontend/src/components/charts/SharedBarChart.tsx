import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from 'recharts';

type Props = {
  data: any[];
  dataKey: string;
  xKey?: string;
  colors?: string[];
  height?: number;
  showLegend?: boolean;
  ariaLabel?: string;
  showValueLabel?: boolean;
};

export default function SharedBarChart({
  data,
  dataKey,
  xKey = 'name',
  colors = ['var(--color-primary)'],
  height = 300,
  showLegend = true,
  ariaLabel,
  showValueLabel = true,
}: Props) {
  const angle = data && data.length > 6 ? -35 : -10;
  const xHeight = data && data.length > 6 ? 56 : 36;

  const total = Array.isArray(data) ? data.reduce((s, d) => s + Number(d[dataKey] || 0), 0) : 0;

  if (!data || data.length === 0 || total === 0) {
    return (
      <div className="text-sm text-slate-500 p-6 rounded-lg bg-[var(--color-light-section)]/60">No data to display</div>
    );
  }

  return (
    <div role="img" aria-label={ariaLabel || 'bar chart'}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" />
          <XAxis dataKey={xKey} angle={angle} textAnchor={angle ? 'end' : 'middle'} height={xHeight} tick={{ fill: 'var(--color-text-light)', fontSize: 12 }} />
          <YAxis tick={{ fill: 'var(--color-text-light)', fontSize: 12 }} />
          <Tooltip formatter={(value: any) => [value, total ? `${Math.round((value / total) * 100)}%` : '0%']} contentStyle={{ borderRadius: 8 }} />
          {showLegend && <Legend verticalAlign="top" align="right" wrapperStyle={{ padding: 8 }} />}
          <Bar dataKey={dataKey} fill={colors[0]} radius={[6, 6, 0, 0]}>
            {showValueLabel && <LabelList dataKey={dataKey} position="top" />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
