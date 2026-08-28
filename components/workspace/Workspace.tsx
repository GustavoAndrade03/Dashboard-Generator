"use client";

/**
 * Orquestra o fluxo inteiro numa única rota: upload -> revisão -> edição ->
 * PDF. Não há "modo visualização": a folha que o usuário edita já é o
 * resultado (CLAUDE.md, 11.1).
 *
 * Manter tudo em uma página é deliberado. Os dados normalizados podem passar
 * de alguns megabytes, e navegar entre rotas exigiria persistir isso em
 * sessionStorage (que estoura) ou no banco (que ainda não é obrigatório para
 * usar a ferramenta).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AddChartPanel } from "@/components/editor/AddChartPanel";
import { ChartInspector } from "@/components/editor/ChartInspector";
import { DataEditor } from "@/components/editor/DataEditor";
import { DashboardCanvas } from "@/components/editor/DashboardCanvas";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { SchemaReview } from "@/components/editor/SchemaReview";
import { UploadForm } from "@/components/upload/UploadForm";
import { createChart, normalizeSpec } from "@/lib/dashboard/chart-spec";
import { DEFAULT_PALETTE_ID, getPalette, type PaletteId } from "@/lib/dashboard/palettes";
import {
  DEFAULT_TEMPLATE_ID,
  applyTemplate,
  chartsOnPage,
  findFreeSlot,
  findSlotOnPage,
  getTemplate,
  normalizePages,
  pageCount,
} from "@/lib/dashboard/templates";
import type { ChartSpec, DashboardPayload, PlacedChart } from "@/lib/dashboard/types";
import { useHistory } from "@/lib/dashboard/use-history";
import type { ParsedWorkbook } from "@/lib/parsing/types";

interface UploadResponse {
  workbook: ParsedWorkbook;
  charts: ChartSpec[];
  provider: "ai" | "heuristic";
  warning?: string;
}

/** Janela em que digitar continua sendo o mesmo passo do histórico. */
const TYPING_WINDOW_MS = 1000;

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.xlsx$/i, "").replace(/[_-]+/g, " ").trim() || "Dashboard";
}

export function Workspace() {
  const history = useHistory<DashboardPayload | null>(null);
  const payload = history.state;

  const [suggestions, setSuggestions] = useState<ChartSpec[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Digitação: o primeiro toque cria o passo, os seguintes só atualizam. Sem
  // isto, desfazer um título exigiria um Ctrl+Z por caractere.
  const typing = useRef<{ key: string; until: number } | null>(null);
  const editText = useCallback(
    (key: string, next: DashboardPayload) => {
      const agora = Date.now();
      const sessao = typing.current;
      if (!sessao || sessao.key !== key || agora > sessao.until) history.commit(next);
      else history.replace(next);
      typing.current = { key, until: agora + TYPING_WINDOW_MS };
    },
    [history],
  );

  const { undo, redo } = history;
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  async function handleUpload(file: File) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = (await response.json()) as UploadResponse & { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Não foi possível ler a planilha. Tente outro arquivo.");
        return;
      }

      const template = getTemplate(DEFAULT_TEMPLATE_ID);
      const placed = applyTemplate(template, data.charts);

      setSuggestions(data.charts);
      setSelectedId(null);
      history.reset({
        workbook: data.workbook,
        config: {
          title: titleFromFileName(file.name),
          templateId: template.id,
          paletteId: DEFAULT_PALETTE_ID,
          charts: placed,
        },
      });
      setNotice(data.warning ?? null);
    } catch {
      setError("A planilha não chegou ao servidor. Verifique a conexão e envie de novo.");
    } finally {
      setBusy(false);
    }
  }

  const template = getTemplate(payload?.config.templateId ?? DEFAULT_TEMPLATE_ID);
  const palette = getPalette(payload?.config.paletteId ?? DEFAULT_PALETTE_ID);
  const charts = useMemo(() => payload?.config.charts ?? [], [payload]);

  /** Sugestões ainda não usadas. Derivar (em vez de guardar) mantém o desfazer coerente. */
  const availableSuggestions = useMemo(
    () => suggestions.filter((item) => !charts.some((chart) => chart.id === item.id)),
    [suggestions, charts],
  );

  const selected = charts.find((chart) => chart.id === selectedId) ?? null;

  /**
   * Todo commit de layout renumera as folhas: uma folha que ficou sem nenhum
   * gráfico deixa de existir, senão o PDF sairia com uma página em branco.
   */
  function commitCharts(next: PlacedChart[]) {
    if (!payload) return;
    history.commit({
      ...payload,
      config: { ...payload.config, charts: normalizePages(next) },
    });
  }

  function addChart(spec: ChartSpec) {
    if (!payload) return;
    const kind = spec.type === "kpi" ? "small" : "large";
    // Nunca falha: se todas as folhas estiverem cheias, abre a próxima.
    const layout = findFreeSlot(charts, template, kind);
    setError(null);
    commitCharts([...charts, { ...spec, layout }]);
    setSelectedId(spec.id);
  }

  const totalPaginas = pageCount(charts);

  function moveToPage(chart: PlacedChart, page: number) {
    if (chart.layout.page === page) return;

    const destino = chartsOnPage(charts, page).filter((item) => item.id !== chart.id);
    const vaga = findSlotOnPage(destino, chart.layout.w, chart.layout.h);
    if (!vaga) {
      setError(
        `A página ${page + 1} não tem espaço para este gráfico. Diminua algo lá ou escolha "Nova página".`,
      );
      return;
    }

    setError(null);
    commitCharts(
      charts.map((item) =>
        item.id === chart.id
          ? { ...item, layout: { ...item.layout, page, x: vaga.x, y: vaga.y } }
          : item,
      ),
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1420px] flex-col gap-6 p-6 print:block print:max-w-none print:gap-0 print:p-0">
      <header className="print:hidden">
        <h1 className="text-2xl font-semibold text-[#0b0b0b]">Planilha em dashboard</h1>
        <p className="mt-1 text-sm text-[#52514e]">
          Envie um .xlsx, ajuste o que a análise sugeriu e gere o PDF.
        </p>
      </header>

      {!payload ? (
        <div className="print:hidden">
          <UploadForm onUpload={handleUpload} busy={busy} />
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-[#e34948] bg-white px-4 py-3 text-sm text-[#e34948] print:hidden">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-md border border-[#eda100] bg-white px-4 py-3 text-sm text-[#52514e] print:hidden">
          {notice}
        </p>
      ) : null}

      {payload ? (
        <>
          <EditorToolbar
            templateId={payload.config.templateId}
            paletteId={payload.config.paletteId}
            pageCount={totalPaginas}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={history.undo}
            onRedo={history.redo}
            onTemplateChange={(id) => {
              const proximo = getTemplate(id);
              const placed = applyTemplate(proximo, charts);
              history.commit({
                ...payload,
                config: { ...payload.config, templateId: id, charts: placed },
              });
            }}
            onPaletteChange={(id: PaletteId) =>
              history.commit({ ...payload, config: { ...payload.config, paletteId: id } })
            }
            onAddChart={() => setSelectedId(null)}
            onPrint={() => window.print()}
          />

          <div className="flex flex-col items-start gap-6 lg:flex-row print:block">
            <DashboardCanvas
              payload={payload}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onLayoutCommit={commitCharts}
              onChartTitleChange={(id, title) =>
                editText(`titulo-${id}`, {
                  ...payload,
                  config: {
                    ...payload.config,
                    charts: charts.map((chart) =>
                      chart.id === id ? { ...chart, title } : chart,
                    ),
                  },
                })
              }
              onDashboardTitleChange={(title) =>
                editText("titulo-dashboard", {
                  ...payload,
                  config: { ...payload.config, title },
                })
              }
              onAddChart={() => setSelectedId(null)}
            />

            <aside
              // Acompanha a rolagem: com várias folhas empilhadas, o painel do
              // gráfico selecionado não pode ficar para trás.
              className="w-full shrink-0 rounded-lg border border-[#e1e0d9] bg-[#fcfcfb] p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:w-80 lg:overflow-y-auto print:hidden"
            >
              {selected ? (
                <ChartInspector
                  spec={selected}
                  workbook={payload.workbook}
                  palette={palette}
                  page={selected.layout.page}
                  pageCount={totalPaginas}
                  onMoveToPage={(page) => moveToPage(selected, page)}
                  onChange={(next) => {
                    const table = payload.workbook.tables.find(
                      (item) => item.schema.key === next.tableKey,
                    );
                    const normalizado = normalizeSpec(next, table);
                    commitCharts(
                      charts.map((chart) =>
                        chart.id === next.id ? { ...normalizado, layout: chart.layout } : chart,
                      ),
                    );
                  }}
                  onRemove={() => {
                    commitCharts(charts.filter((chart) => chart.id !== selected.id));
                    setSelectedId(null);
                  }}
                />
              ) : (
                <AddChartPanel
                  suggestions={availableSuggestions}
                  palette={palette}
                  onAddSuggestion={addChart}
                  onCreateBlank={() => {
                    const table = payload.workbook.tables[0];
                    if (table) addChart(createChart(table, crypto.randomUUID()));
                  }}
                />
              )}
            </aside>
          </div>

          <details className="rounded-lg border border-[#e1e0d9] bg-[#fcfcfb] print:hidden">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-[#0b0b0b]">
              Valores da sua planilha
            </summary>
            <div className="border-t border-[#e1e0d9] p-4">
              <p className="mb-3 text-xs text-[#52514e]">
                Corrija um número errado ou apague uma linha que não deve entrar nos gráficos.
                Tudo é reversível pelo desfazer.
              </p>
              <DataEditor
                workbook={payload.workbook}
                onChange={(workbook) => history.commit({ ...payload, workbook })}
              />
            </div>
          </details>

          <details className="rounded-lg border border-[#e1e0d9] bg-[#fcfcfb] print:hidden">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-[#0b0b0b]">
              Colunas da sua planilha
            </summary>
            <div className="border-t border-[#e1e0d9] p-4">
              <p className="mb-3 text-xs text-[#52514e]">
                Confira como cada coluna foi entendida. Corrigir aqui atualiza os gráficos.
              </p>
              <SchemaReview
                workbook={payload.workbook}
                onChange={(workbook) => history.commit({ ...payload, workbook })}
              />
            </div>
          </details>
        </>
      ) : null}
    </main>
  );
}
