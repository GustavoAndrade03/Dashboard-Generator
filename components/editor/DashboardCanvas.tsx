"use client";

/**
 * As folhas. Não são uma "prévia": são a área de edição, e cada uma tem
 * exatamente as dimensões da área útil do A4 paisagem, então o usuário vê os
 * limites da página enquanto arrasta (CLAUDE.md, 11.1 e 11.2).
 *
 * O dashboard tem quantas folhas forem necessárias, empilhadas na vertical.
 * Cada folha é uma grade independente com teto de linhas: é isso que impede
 * um gráfico de atravessar a quebra de página e sair cortado no PDF.
 */

import GridLayout, { type Layout } from "react-grid-layout";

import { ChartCard } from "@/components/charts/ChartCard";
import {
  GRID_COLS,
  GRID_GAP,
  GRID_HEIGHT,
  GRID_ROWS,
  GRID_ROW_HEIGHT,
  PAGE_HEADER_HEIGHT,
  PAGE_WIDTH,
  SHEET_HEIGHT,
} from "@/lib/dashboard/page";
import { getPalette } from "@/lib/dashboard/palettes";
import { chartsOnPage, pageCount } from "@/lib/dashboard/templates";
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
  const total = pageCount(config.charts);

  function handleCommit(page: number, next: Layout) {
    const porId = new Map(next.map((item) => [item.i, item]));
    onLayoutCommit(
      config.charts.map((chart) => {
        const item = porId.get(chart.id);
        if (!item || chart.layout.page !== page) return chart;
        return { ...chart, layout: { page, x: item.x, y: item.y, w: item.w, h: item.h } };
      }),
    );
  }

  return (
    <div className="overflow-x-auto print:overflow-visible">
      {/* Bloco, não flex: o Chrome não pagina de forma confiável dentro de um
          container flex, e é entre estas folhas que a quebra precisa cair. */}
      <div className="w-max print:w-auto">
        {Array.from({ length: total }, (_, page) => (
          <section
            key={page}
            style={{ width: PAGE_WIDTH, height: SHEET_HEIGHT }}
            // O espaço entre folhas é classe, e não estilo inline, porque
            // precisa zerar na impressão — onde quem separa é a quebra.
            className="dashboard-page mb-6 bg-white shadow-sm ring-1 ring-[#e1e0d9] last:mb-0 print:mb-0 print:shadow-none print:ring-0"
            // Clicar no vazio da folha limpa a seleção.
            onMouseDown={() => onSelect(null)}
          >
            <header
              style={{ height: PAGE_HEADER_HEIGHT }}
              className="flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                {page === 0 ? (
                  <>
                    <input
                      className="rgl-no-drag w-full truncate rounded border border-transparent bg-transparent px-1 text-xl font-semibold text-[#0b0b0b] hover:border-[#e1e0d9] focus:border-[#2a78d6] focus:outline-none"
                      value={config.title}
                      aria-label="Título do dashboard"
                      onChange={(event) => onDashboardTitleChange(event.target.value)}
                      onMouseDown={(event) => event.stopPropagation()}
                    />
                    <p className="truncate px-1 text-xs text-[#898781]">{workbook.source.label}</p>
                  </>
                ) : (
                  // Nas folhas seguintes o título é só referência: quem edita
                  // é o campo da primeira, para não haver dois donos do mesmo dado.
                  <p className="truncate px-1 text-sm font-medium text-[#52514e]">{config.title}</p>
                )}
              </div>

              {total > 1 ? (
                <span className="shrink-0 px-1 text-xs text-[#898781]">
                  Página {page + 1} de {total}
                </span>
              ) : null}
            </header>

            {config.charts.length === 0 ? (
              <EmptyCanvas onAddChart={onAddChart} />
            ) : (
              <GridLayout
                width={PAGE_WIDTH}
                layout={chartsOnPage(config.charts, page).map((chart) => ({
                  i: chart.id,
                  x: chart.layout.x,
                  y: chart.layout.y,
                  w: chart.layout.w,
                  h: chart.layout.h,
                }))}
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
                onDragStop={(next) => handleCommit(page, next)}
                onResizeStop={(next) => handleCommit(page, next)}
              >
                {chartsOnPage(config.charts, page).map((chart) => (
                  <div
                    key={chart.id}
                    tabIndex={0}
                    aria-label={`Gráfico ${chart.title}`}
                    className={`cursor-grab rounded-lg outline-none ring-offset-2 active:cursor-grabbing ${
                      selectedId === chart.id
                        ? "ring-2 ring-[#2a78d6]"
                        : "focus-visible:ring-2 focus-visible:ring-[#2a78d6]"
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
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function EmptyCanvas({ onAddChart }: { onAddChart: () => void }) {
  return (
    <div
      style={{ height: GRID_HEIGHT }}
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
