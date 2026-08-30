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
import { EditorToolbar, type ToolPanel } from "@/components/editor/EditorToolbar";
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

function Mensagem({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-[#e34948] bg-white px-4 py-3 text-sm text-[#e34948] print:hidden"
    >
      {children}
    </p>
  );
}

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
  /** Ferramenta da planilha aberta abaixo da barra de ações. */
  const [openPanel, setOpenPanel] = useState<ToolPanel>(null);
  /** Volta a mostrar o formulário de envio depois que já existe um dashboard. */
  const [showUpload, setShowUpload] = useState(false);

  /**
   * "Adicionar gráfico" apenas revela o painel lateral. Se ele já estivesse
   * visível, o clique não teria efeito nenhum aos olhos do usuário — o pulso
   * move o foco para a primeira opção, que é o retorno visível da ação.
   */
  const [addPulse, setAddPulse] = useState(0);
  const asideRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (addPulse === 0) return;
    const aside = asideRef.current;
    if (!aside) return;
    aside.scrollIntoView({ block: "nearest" });
    aside.querySelector("button")?.focus();
  }, [addPulse]);

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
      setOpenPanel(null);
      setShowUpload(false);
      history.reset({
        workbook: data.workbook,
        config: {
          title: titleFromFileName(file.name),
          templateId: template.id,
          paletteId: DEFAULT_PALETTE_ID,
          charts: placed,
        },
      });
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

  /**
   * O quadro com menos gráficos na folha. Montar do zero partindo sempre do
   * primeiro quadro produzia cópias idênticas do mesmo gráfico, o que parece
   * defeito; partindo do menos usado, cada clique traz dado novo.
   */
  function leastUsedTable() {
    const tabelas = payload?.workbook.tables ?? [];
    let escolhida = tabelas[0];
    let menor = Infinity;
    for (const tabela of tabelas) {
      const usos = charts.filter((chart) => chart.tableKey === tabela.schema.key).length;
      if (usos < menor) {
        menor = usos;
        escolhida = tabela;
      }
    }
    return escolhida;
  }

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
      {/*
        Depois do upload o cabeçalho encolhe: o dashboard é o assunto da tela,
        e o subtítulo que explicava o fluxo já cumpriu o papel dele.
      */}
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1
            className={
              payload
                ? "text-base font-semibold text-[#0b0b0b]"
                : "text-2xl font-semibold text-[#0b0b0b]"
            }
          >
            Planilha em dashboard
          </h1>
          {!payload ? (
            <p className="mt-1 text-sm text-[#52514e]">
              Envie um .xlsx, ajuste o que a análise sugeriu e gere o PDF.
            </p>
          ) : null}
        </div>

        {payload && !showUpload ? (
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="rounded-md border border-[#e1e0d9] bg-white px-3 py-1.5 text-xs text-[#52514e] hover:border-[#2a78d6] hover:text-[#2a78d6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
          >
            Enviar outra planilha
          </button>
        ) : null}
      </header>

      {/* Falha no envio acontece antes de existir dashboard, e a mensagem tem
          de aparecer junto do formulário que a provocou. */}
      {!payload && error ? <Mensagem>{error}</Mensagem> : null}

      {!payload || showUpload ? (
        <div className="print:hidden">
          <UploadForm onUpload={handleUpload} busy={busy} />
          {payload ? (
            <p className="mt-2 text-xs text-[#898781]">
              Enviar outra planilha começa um dashboard novo. O atual se perde —
              gere o PDF antes, se ainda precisar dele.
            </p>
          ) : null}
        </div>
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
            openPanel={openPanel}
            onTogglePanel={setOpenPanel}
            onAddChart={() => {
              setSelectedId(null);
              setAddPulse((n) => n + 1);
            }}
            onPrint={() => window.print()}
          />

          {/*
            Mensagem logo abaixo da barra, e não no topo da página: com folhas
            empilhadas, um aviso lá em cima passaria despercebido.
          */}
          {error ? <Mensagem>{error}</Mensagem> : null}

          {openPanel ? (
            <section className="rounded-lg border border-[#e1e0d9] bg-[#fcfcfb] p-4 print:hidden">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-[#0b0b0b]">
                    {openPanel === "dados"
                      ? "Corrigir os dados da planilha"
                      : "Como as colunas foram entendidas"}
                  </h2>
                  <p className="mt-1 text-xs text-[#52514e]">
                    {openPanel === "dados"
                      ? "Corrija um número errado ou apague uma linha que não deve entrar nos gráficos. Os gráficos mudam na hora, e tudo é reversível pelo desfazer."
                      : "Se uma coluna de números foi lida como texto, corrija aqui — os gráficos se ajustam sozinhos."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenPanel(null)}
                  className="shrink-0 rounded border border-[#e1e0d9] px-2.5 py-1 text-xs text-[#52514e] hover:border-[#c3c2b7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
                >
                  Fechar
                </button>
              </div>

              {openPanel === "dados" ? (
                <DataEditor
                  workbook={payload.workbook}
                  onChange={(workbook) => history.commit({ ...payload, workbook })}
                />
              ) : (
                <SchemaReview
                  workbook={payload.workbook}
                  onChange={(workbook) => history.commit({ ...payload, workbook })}
                />
              )}
            </section>
          ) : null}

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
              onAddChart={() => {
                setSelectedId(null);
                setAddPulse((n) => n + 1);
              }}
            />

            <aside
              ref={asideRef}
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
                    // O quadro menos usado, e não sempre o primeiro: montar
                    // três gráficos seguidos produzia três cópias iguais.
                    const table = leastUsedTable();
                    if (table) addChart(createChart(table, crypto.randomUUID()));
                  }}
                />
              )}
            </aside>
          </div>

        </>
      ) : null}
    </main>
  );
}
