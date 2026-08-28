"use client";

/**
 * A folha. Não é uma "prévia": é a área de edição, e tem exatamente as
 * dimensões da área útil do A4 paisagem, então o usuário vê os limites da
 * página enquanto arrasta (CLAUDE.md, 11.1 e 11.2).
 *
 * A grade só aceita posições válidas — compactação vertical automática (nunca
 * sobra buraco) e teto de linhas igual à altura da folha. É a aplicação do
 * "restrinja as possibilidades em vez de dar liberdade total".
 */

import GridLayout, { type Layout } from "react-grid-layout";

import { ChartCard } from "@/components/charts/ChartCard";
import {
  GRID_AREA_HEIGHT,
  GRID_COLS,
  GRID_GAP,
  GRID_ROWS,
  GRID_ROW_HEIGHT,
  PAGE_HEADER_HEIGHT,
  PAGE_WIDTH,
} from "@/lib/dashboard/page";
import { getPalette } from "@/lib/dashboard/palettes";
import type { DashboardPayload, PlacedChart } from "@/lib/dashboard/types";

interface DashboardCanvasProps {
  payload: DashboardPayload;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Chamado ao soltar um arrasto ou redimensionamento — vira um passo no histórico. */
  onLayoutCommit: (charts: PlacedChart[]) => void;
  onChartTitleChange: (id: string, title: string) => void;
  onDashboardTitleChange: (title: string) => void;
  onAddChart: () => void;
}

export function DashboardCanvas({
  payload,
  selectedId,
  onSelect,
  onLayoutCommit,
  onChartTitleChange,
  onDashboardTitleChange,
  onAddChart,
}: DashboardCanvasProps) {
  const { config, workbook } = payload;
  const palette = getPalette(config.paletteId);

  const layout: Layout = config.charts.map((chart) => ({ i: chart.id, ...chart.layout }));

  function handleCommit(next: Layout) {
    const porId = new Map(next.map((item) => [item.i, item]));
    onLayoutCommit(
      config.charts.map((chart) => {
        const item = porId.get(chart.id);
        return item ? { ...chart, layout: { x: item.x, y: item.y, w: item.w, h: item.h } } : chart;
      }),
    );
  }

  return (
    <div className="overflow-x-auto print:overflow-visible">
      <div
        // A largura fixa é o que faz tela e papel coincidirem: o Recharts mede
        // em JS, e uma caixa que mudasse de tamanho ao imprimir sairia errada.
        style={{ width: PAGE_WIDTH }}
        className="bg-white shadow-sm ring-1 ring-[#e1e0d9] print:shadow-none print:ring-0"
        // Clicar no vazio da folha limpa a seleção.
        onMouseDown={() => onSelect(null)}
      >
        <header style={{ height: PAGE_HEADER_HEIGHT }} className="flex flex-col justify-center">
          <input
            className="rgl-no-drag w-full truncate rounded border border-transparent bg-transparent px-1 text-xl font-semibold text-[#0b0b0b] hover:border-[#e1e0d9] focus:border-[#2a78d6] focus:outline-none"
            value={config.title}
            aria-label="Título do dashboard"
            onChange={(event) => onDashboardTitleChange(event.target.value)}
            onMouseDown={(event) => event.stopPropagation()}
          />
          <p className="truncate px-1 text-xs text-[#898781]">{workbook.source.label}</p>
        </header>

        {config.charts.length === 0 ? (
          <EmptyCanvas onAddChart={onAddChart} />
        ) : (
          <div style={{ minHeight: GRID_AREA_HEIGHT }}>
            <GridLayout
              width={PAGE_WIDTH}
              layout={layout}
              gridConfig={{
                cols: GRID_COLS,
                rowHeight: GRID_ROW_HEIGHT,
                margin: [GRID_GAP, GRID_GAP],
                containerPadding: [0, 0],
                maxRows: GRID_ROWS,
              }}
              // Campos de texto e controles não podem iniciar um arrasto.
              dragConfig={{ cancel: ".rgl-no-drag" }}
              resizeConfig={{ handles: ["se"] }}
              onDragStop={handleCommit}
              onResizeStop={handleCommit}
            >
              {config.charts.map((chart) => (
                <div
                  key={chart.id}
                  tabIndex={0}
                  aria-label={`Gráfico ${chart.title}`}
                  className={`cursor-grab rounded-lg outline-none ring-offset-2 active:cursor-grabbing ${
                    selectedId === chart.id ? "ring-2 ring-[#2a78d6]" : "focus-visible:ring-2 focus-visible:ring-[#2a78d6]"
                  }`}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    onSelect(chart.id);
                  }}
                  // Navegar por teclado seleciona, então o painel de edição
                  // acompanha o foco sem exigir clique.
                  onFocus={() => onSelect(chart.id)}
                >
                  <ChartCard
                    spec={chart}
                    workbook={workbook}
                    palette={palette}
                    onTitleChange={(title) => onChartTitleChange(chart.id, title)}
                  />
                </div>
              ))}
            </GridLayout>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyCanvas({ onAddChart }: { onAddChart: () => void }) {
  return (
    <div
      style={{ height: GRID_AREA_HEIGHT }}
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#c3c2b7]"
    >
      <p className="text-sm text-[#52514e]">Esta folha ainda está em branco.</p>
      <button
        type="button"
        onClick={onAddChart}
        className="rounded-md bg-[#0b0b0b] px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
      >
        Adicionar um gráfico
      </button>
    </div>
  );
}
