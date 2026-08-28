"use client";

/**
 * Renderiza um ChartSpec. O mesmo componente serve a tela e a impressão: o PDF
 * é a própria página impressa pelo navegador, então não existe uma segunda
 * implementação para divergir da primeira (CLAUDE.md, 11.1).
 *
 * O cartão preenche a altura da célula que recebe na grade — quem manda no
 * tamanho é o layout, não o gráfico.
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
import { colorAt, type Palette } from "@/lib/dashboard/palettes";
import { INK, formatCompact, formatNumber } from "@/lib/dashboard/theme";
import type { ChartSpec } from "@/lib/dashboard/types";
import type { ParsedWorkbook } from "@/lib/parsing/types";

/** Rótulos de categoria longos se sobrepõem em cartões estreitos. */
const MAX_TICK_CHARS = 14;

function shortenTick(value: unknown): string {
  const texto = String(value ?? "");
  return texto.length > MAX_TICK_CHARS ? `${texto.slice(0, MAX_TICK_CHARS - 1)}…` : texto;
}

const axisProps = {
  stroke: INK.baseline,
  tick: { fill: INK.muted, fontSize: 11 },
  tickLine: false,
} as const;

interface ChartCardProps {
  spec: ChartSpec;
  workbook: ParsedWorkbook;
  palette: Palette;
  /** Quando presente, o título vira editável no próprio cartão. */
  onTitleChange?: (title: string) => void;
}

export function ChartCard({ spec, workbook, palette, onTitleChange }: ChartCardProps) {
  const data = useMemo(() => buildChartData(workbook, spec), [workbook, spec]);

  return (
    <figure className="flex h-full flex-col overflow-hidden rounded-lg border border-[#e1e0d9] bg-[#fcfcfb] p-3">
      <figcaption className="mb-2 shrink-0">
        {onTitleChange ? (
          <input
            // rgl-no-drag: sem isto, clicar para editar iniciaria um arrasto.
            className="rgl-no-drag w-full truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-[#0b0b0b] hover:border-[#e1e0d9] focus:border-[#2a78d6] focus:outline-none"
            value={spec.title}
            aria-label="Título do gráfico"
            onChange={(event) => onTitleChange(event.target.value)}
          />
        ) : (
          <h3 className="truncate px-1 text-sm font-semibold text-[#0b0b0b]">{spec.title}</h3>
        )}
      </figcaption>

      <div className="min-h-0 flex-1">
        {data.error ? (
          <p className="px-1 text-xs text-[#52514e]">{data.error}</p>
        ) : (
          <ChartBody spec={spec} data={data} palette={palette} />
        )}
      </div>
    </figure>
  );
}

type ChartData = ReturnType<typeof buildChartData>;

interface BodyProps {
  spec: ChartSpec;
  data: ChartData;
  palette: Palette;
}

function ChartBody({ spec, data, palette }: BodyProps) {
  if (spec.type === "kpi") {
    return (
      <div className="flex h-full flex-col justify-center px-1">
        <p className="truncate text-3xl font-semibold tabular-nums text-[#0b0b0b]">
          {formatNumber(data.kpi?.value)}
        </p>
        <p className="mt-1 truncate text-xs text-[#52514e]">{data.kpi?.label}</p>
      </div>
    );
  }

  if (spec.type === "table") return <DataTable data={data} />;

  if (data.rows.length === 0) {
    return <p className="px-1 text-xs text-[#52514e]">Sem dados para exibir.</p>;
  }

  // Legenda sempre presente a partir de 2 séries; com 1 série o título já a nomeia.
  const showLegend = data.series.length > 1;
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
  const legend = showLegend ? (
    <Legend wrapperStyle={{ fontSize: 11, color: INK.secondary }} iconType="circle" iconSize={8} />
  ) : null;

  if (spec.type === "pie") {
    const key = data.series[0].key;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.rows}
            dataKey={key}
            nameKey="label"
            innerRadius="45%"
            outerRadius="78%"
            isAnimationActive={false}
            // Anel na cor da superfície separa as fatias adjacentes.
            stroke="#fcfcfb"
            strokeWidth={2}
          >
            {data.rows.map((row, index) => (
              <Cell key={String(row.label)} fill={colorAt(palette, index)} />
            ))}
          </Pie>
          <Legend
            wrapperStyle={{ fontSize: 11, color: INK.secondary }}
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
      <XAxis dataKey="label" {...axisProps} tickFormatter={shortenTick} />
      <YAxis {...axisProps} tickFormatter={formatCompact} width={48} />
    </>
  );
  const margin = { top: 4, right: 8, bottom: 0, left: 0 };

  if (spec.type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.rows} margin={margin}>
          {grid}
          {axes}
          {data.series.map((series, index) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={colorAt(palette, index)}
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
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.rows} margin={margin}>
          {grid}
          {axes}
          {data.series.map((series, index) => (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={colorAt(palette, index)}
              strokeWidth={2}
              fill={colorAt(palette, index)}
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
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data.rows} margin={margin}>
        {grid}
        {axes}
        {data.series.map((series, index) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            name={series.label}
            fill={colorAt(palette, index)}
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
    <div className="h-full overflow-auto">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-[#fcfcfb]">
          <tr className="border-b border-[#e1e0d9]">
            {data.series.map((series) => (
              <th key={series.key} className="px-2 py-1 font-medium text-[#52514e]">
                {series.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, index) => (
            <tr key={index} className="border-b border-[#e1e0d9] last:border-0">
              {data.series.map((series) => (
                <td key={series.key} className="px-2 py-1 text-[#0b0b0b]">
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
