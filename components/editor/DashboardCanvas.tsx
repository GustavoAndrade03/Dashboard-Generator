"use client";

/**
 * As folhas. Não são uma "prévia": são a área de edição, e cada uma tem
 * exatamente as dimensões da área útil do A4 paisagem, então o usuário vê os
 * limites da página enquanto arrasta (CLAUDE.md, 11.1 e 11.2).
 *
 * O dashboard tem quantas folhas forem necessárias, empilhadas na vertical.
 * Cada folha é uma grade independente com teto de linhas: é isso que impede
 * um gráfico de atravessar a quebra de página e sair cortado no PDF.
 *
 * A folha é a única superfície branca da aplicação. Todo o resto é bancada
 * escura, e é essa diferença que informa, sem texto nenhum, o que sai impresso.
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
  cardSize,
} from "@/lib/dashboard/page";
import { getPalette } from "@/lib/dashboard/palettes";
import { getSheetTheme, sheetVars } from "@/lib/dashboard/themes";
import { chartsOnPage, pageCount } from "@/lib/dashboard/templates";
import type { DashboardPayload, PlacedChart } from "@/lib/dashboard/types";

/**
 * Espaço entre folhas na tela. Precisa bater com a classe `mb-6` aplicada em
 * cada folha: é por ele que a régua de páginas calcula onde fica cada marca,
 * em vez de medir o DOM a cada arrasto.
 */
const SHEET_GAP = 24;

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
  const theme = getSheetTheme(config.themeId);
  const total = pageCount(config.charts);
  const paginaAtiva =
    config.charts.find((chart) => chart.id === selectedId)?.layout.page ?? null;

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
          container flex, e é entre estas folhas que a quebra precisa cair. A
          régua fica em posição absoluta, fora do fluxo que é paginado. */}
      <div className="relative w-max pl-9 print:w-auto print:pl-0">
        <ReguaDePaginas total={total} ativa={paginaAtiva} />

        {Array.from({ length: total }, (_, page) => (
          <section
            key={page}
            id={`folha-${page}`}
            style={{
              // As variáveis do tema descem daqui para tudo que está na folha:
              // fundo do cartão, tinta, grade e anel de foco.
              ...sheetVars(theme),
              width: PAGE_WIDTH,
              height: SHEET_HEIGHT,
              // Uma subida só, escalonada: as folhas chegam como páginas de um
              // documento, e não como cartões independentes.
              animationDelay: `${page * 60}ms`,
            }}
            // O espaço entre folhas é classe, e não estilo inline, porque
            // precisa zerar na impressão — onde quem separa é a quebra.
            className="dashboard-page folha mb-6 last:mb-0 print:mb-0"
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
                      className="rgl-no-drag expandida w-full truncate rounded-[3px] border border-transparent bg-transparent px-1 text-xl font-semibold text-ink hover:border-gridline focus:border-ink focus:outline-none"
                      value={config.title}
                      aria-label="Título do dashboard"
                      onChange={(event) => onDashboardTitleChange(event.target.value)}
                      onMouseDown={(event) => event.stopPropagation()}
                    />
                    <p className="utilitaria truncate px-1 text-ink-3">
                      {workbook.source.label}
                    </p>
                  </>
                ) : (
                  // Nas folhas seguintes o título é só referência: quem edita
                  // é o campo da primeira, para não haver dois donos do mesmo dado.
                  <p className="expandida truncate px-1 text-sm font-semibold text-ink-2">
                    {config.title}
                  </p>
                )}
              </div>

              {total > 1 ? (
                <span className="utilitaria shrink-0 px-1 text-ink-3">
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
                    // O anel de seleção é grafite, não azul: azul é a primeira
                    // cor de série da paleta padrão, e a ferramenta não pode
                    // usar a mesma tinta que o dado do usuário.
                    className={`cursor-grab rounded-[6px] outline-none ring-offset-2 active:cursor-grabbing ${
                      selectedId === chart.id
                        ? "ring-2 ring-ink"
                        : "focus-visible:ring-2 focus-visible:ring-ink"
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
                      theme={theme}
                      size={cardSize(chart.layout.w, chart.layout.h)}
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

/**
 * Régua de páginas.
 *
 * A numeração só existe quando há mais de uma folha: com uma só, "1" não
 * informa nada. As marcas são a ordem real das páginas do PDF, e clicar em uma
 * leva até ela — que é o que falta quando o documento passa de três telas de
 * altura.
 */
function ReguaDePaginas({ total, ativa }: { total: number; ativa: number | null }) {
  if (total < 2) return null;

  function irPara(page: number) {
    const folha = document.getElementById(`folha-${page}`);
    if (!folha) return;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    folha.scrollIntoView({ block: "start", behavior: reduzido ? "auto" : "smooth" });
  }

  return (
    <nav
      aria-label="Páginas do dashboard"
      className="absolute left-0 top-0 w-9 print:hidden"
      style={{ height: total * SHEET_HEIGHT + (total - 1) * SHEET_GAP }}
    >
      <span aria-hidden className="absolute left-4 top-1 bottom-1 w-px bg-borda" />

      {Array.from({ length: total }, (_, page) => (
        <button
          key={page}
          type="button"
          onClick={() => irPara(page)}
          aria-current={page === ativa ? "true" : undefined}
          className="group absolute left-0 flex w-9 items-center gap-1.5"
          style={{ top: page * (SHEET_HEIGHT + SHEET_GAP) + PAGE_HEADER_HEIGHT / 2 - 8 }}
        >
          <span
            aria-hidden
            className={`utilitaria w-4 text-right leading-4 transition-colors ${
              page === ativa ? "text-osso" : "text-osso-fraco group-hover:text-osso"
            }`}
          >
            {page + 1}
          </span>
          <span
            aria-hidden
            className={`h-px w-2.5 transition-colors ${
              page === ativa ? "bg-osso" : "bg-borda-forte group-hover:bg-osso"
            }`}
          />
          <span className="sr-only">Ir para a página {page + 1}</span>
        </button>
      ))}
    </nav>
  );
}

function EmptyCanvas({ onAddChart }: { onAddChart: () => void }) {
  return (
    <div
      style={{ height: GRID_HEIGHT }}
      className="flex flex-col items-center justify-center gap-4 rounded-[6px] border border-dashed border-baseline"
    >
      <p className="text-sm text-ink-2">Esta folha ainda está em branco.</p>
      <button
        type="button"
        onClick={onAddChart}
        className="expandida rounded-[3px] bg-ink px-4 py-2 text-sm font-semibold text-white"
      >
        Adicionar um gráfico
      </button>
    </div>
  );
}
