"use client";

/**
 * Renderiza um ChartSpec. O mesmo componente serve a tela e a impressão: o
 * PDF é a própria página impressa pelo navegador, então não existe uma
 * segunda implementação para divergir da primeira.
 *
 * Animações ficam desligadas de propósito: a impressão captura a página em um
 * instante, e uma animação em curso viraria um gráfico pela metade.
 */

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { buildChartData } from "@/lib/dashboard/aggregate";
import { INK, formatCompact, formatNumber, seriesColor } from "@/lib/dashboard/palette";
import type { ChartSpec } from "@/lib/dashboard/types";
import type { ParsedWorkbook } from "@/lib/parsing/types";

const CHART_HEIGHT = 260;

const axisProps = {
  stroke: INK.baseline,
  tick: { fill: INK.muted, fontSize: 12 },
  tickLine: false,
} as const;

interface ChartCardProps {
  spec: ChartSpec;
  workbook: ParsedWorkbook;
}

export function ChartCard({ spec, workbook }: ChartCardProps) {
  const data = useMemo(() => buildChartData(workbook, spec), [workbook, spec]);

  return (
    <figure className="flex break-inside-avoid flex-col rounded-lg border border-[#e1e0d9] bg-[#fcfcfb] p-4">
      <figcaption className="mb-3">
        <h3 className="text-sm font-semibold text-[#0b0b0b]">{spec.title}</h3>
        {spec.rationale ? (
          <p className="mt-0.5 text-xs text-[#898781]">{spec.rationale}</p>
        ) : null}
      </figcaption>

      {data.error ? (
        <p className="py-8 text-center text-sm text-[#52514e]">{data.error}</p>
      ) : (
        <ChartBody spec={spec} data={data} />
      )}
    </figure>
  );
}

type ChartData = ReturnType<typeof buildChartData>;

function ChartBody({ spec, data }: { spec: ChartSpec; data: ChartData }) {
  if (spec.type === "kpi") {
    return (
      <div className="py-6">
        <p className="text-4xl font-semibold tabular-nums text-[#0b0b0b]">
          {formatNumber(data.kpi?.value)}
        </p>
        <p className="mt-1 text-sm text-[#52514e]">{data.kpi?.label}</p>
      </div>
    );
  }

  if (spec.type === "table") {
    return <DataTable data={data} />;
  }

  if (data.rows.length === 0) {
    return <p className="py-8 text-center text-sm text-[#52514e]">Sem dados para exibir.</p>;
  }

  // Legenda sempre presente a partir de 2 séries; com 1 série o título já a nomeia.
  const showLegend = data.series.length > 1;
  // O Tooltip só aparece no hover, então não interfere na impressão.
  const tooltip = (
    <Tooltip
      formatter={(value: unknown) =>
        typeof value === "number" ? formatNumber(value) : String(value ?? "—")
      }
      contentStyle={{
        borderRadius: 6,
        border: `1px solid ${INK.gridline}`,
        fontSize: 12,
        color: INK.primary,
      }}
    />
  );

  if (spec.type === "pie") {
    const key = data.series[0].key;
    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <PieChart>
          <Pie
            data={data.rows}
            dataKey={key}
            nameKey="label"
            innerRadius="45%"
            outerRadius="78%"
            isAnimationActive={false}
            // Anel de 2px na cor da superfície separa as fatias adjacentes.
            stroke="#fcfcfb"
            strokeWidth={2}
          >
            {data.rows.map((row, index) => (
              <Cell key={String(row.label)} fill={seriesColor(index)} />
            ))}
          </Pie>
          <Legend
            wrapperStyle={{ fontSize: 12, color: INK.secondary }}
            iconType="circle"
            iconSize={8}
          />
          {tooltip}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const grid = <CartesianGrid stroke={INK.gridline} strokeDasharray="0" vertical={false} />;
  const axes = (
    <>
      <XAxis dataKey="label" {...axisProps} />
      <YAxis {...axisProps} tickFormatter={formatCompact} width={56} />
    </>
  );
  const legend = showLegend ? (
    <Legend wrapperStyle={{ fontSize: 12, color: INK.secondary }} iconType="circle" iconSize={8} />
  ) : null;

  if (spec.type === "line") {
    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data.rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {grid}
          {axes}
          {data.series.map((series, index) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={seriesColor(index)}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
          {legend}
          {tooltip}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (spec.type === "area") {
    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={data.rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {grid}
          {axes}
          {data.series.map((series, index) => (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={seriesColor(index)}
              strokeWidth={2}
              fill={seriesColor(index)}
              fillOpacity={0.15}
              isAnimationActive={false}
            />
          ))}
          {legend}
          {tooltip}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data.rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        {grid}
        {axes}
        {data.series.map((series, index) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            name={series.label}
            fill={seriesColor(index)}
            // Ponta arredondada só no topo, ancorada na linha de base.
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        ))}
        {legend}
        {tooltip}
      </BarChart>
    </ResponsiveContainer>
  );
}

function DataTable({ data }: { data: ChartData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[#e1e0d9]">
            {data.series.map((series) => (
              <th key={series.key} className="px-2 py-1.5 font-medium text-[#52514e]">
                {series.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, index) => (
            <tr key={index} className="border-b border-[#e1e0d9] last:border-0">
              {data.series.map((series) => (
                <td key={series.key} className="px-2 py-1.5 text-[#0b0b0b]">
                  {typeof row[series.key] === "number"
                    ? formatNumber(row[series.key] as number)
                    : String(row[series.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
