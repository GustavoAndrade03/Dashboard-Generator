"use client";

/**
 * Orquestra o fluxo inteiro numa única rota: upload -> revisão -> edição ->
 * exportação.
 *
 * Manter tudo em uma página é deliberado. Os dados normalizados podem passar
 * de alguns megabytes, e navegar entre rotas exigiria persistir isso em
 * sessionStorage (que estoura) ou no banco (que ainda não é obrigatório para
 * usar a ferramenta).
 *
 * A exportação é `window.print()`: o usuário vê o arquivo final na janela de
 * impressão antes de salvar. O que não deve sair no papel está marcado com
 * `print:hidden`.
 */

import { useState } from "react";

import { DashboardView } from "@/components/charts/DashboardView";
import { ChartEditor } from "@/components/editor/ChartEditor";
import { SchemaReview } from "@/components/editor/SchemaReview";
import { UploadForm } from "@/components/upload/UploadForm";
import type { ChartSpec, DashboardPayload } from "@/lib/dashboard/types";
import type { ParsedWorkbook } from "@/lib/parsing/types";

interface UploadResponse {
  workbook: ParsedWorkbook;
  charts: ChartSpec[];
  provider: "ai" | "heuristic";
  warning?: string;
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.xlsx$/i, "").replace(/[_-]+/g, " ").trim() || "Dashboard";
}

export function Workspace() {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
        setError(data.error ?? "Não foi possível processar a planilha.");
        return;
      }

      setPayload({
        workbook: data.workbook,
        config: { title: titleFromFileName(file.name), charts: data.charts },
      });
      setNotice(data.warning ?? null);
    } catch {
      setError("Falha de rede ao enviar a planilha.");
    } finally {
      setBusy(false);
    }
  }

  function updateConfig(charts: ChartSpec[]) {
    setPayload((current) =>
      current ? { ...current, config: { ...current.config, charts } } : current,
    );
  }

  function addChart() {
    if (!payload) return;
    const table = payload.workbook.tables[0];
    if (!table) return;
    const category = table.schema.columns.find((column) =>
      ["date", "category", "boolean"].includes(column.type),
    );
    const value = table.schema.columns.find((column) => column.type === "number");

    updateConfig([
      ...payload.config.charts,
      {
        id: crypto.randomUUID(),
        type: "bar",
        title: "Novo gráfico",
        tableKey: table.schema.key,
        categoryKey: category?.key ?? null,
        valueKeys: value ? [value.key] : [],
        aggregation: value ? "sum" : "count",
        limit: 12,
        rationale: "",
        origin: "user",
      },
    ]);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 print:max-w-none print:gap-0 print:p-0">
      <header className="print:hidden">
        <h1 className="text-2xl font-semibold text-[#0b0b0b]">Planilha em Dashboard</h1>
        <p className="mt-1 text-sm text-[#52514e]">
          Envie um .xlsx, confira o que foi detectado e exporte em PDF.
        </p>
      </header>

      <div className="print:hidden">
        <UploadForm onUpload={handleUpload} busy={busy} />
      </div>

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
          <section className="flex flex-col gap-3 print:hidden">
            <h2 className="text-lg font-semibold text-[#0b0b0b]">1. Dados detectados</h2>
            <SchemaReview
              workbook={payload.workbook}
              onChange={(workbook) =>
                setPayload((current) => (current ? { ...current, workbook } : current))
              }
            />
          </section>

          <section className="flex flex-col gap-3 print:hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#0b0b0b]">2. Gráficos</h2>
              <button
                type="button"
                onClick={addChart}
                className="rounded-md border border-[#e1e0d9] px-3 py-1.5 text-sm text-[#52514e] hover:border-[#2a78d6] hover:text-[#2a78d6]"
              >
                Adicionar gráfico
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {payload.config.charts.map((chart) => (
                <ChartEditor
                  key={chart.id}
                  spec={chart}
                  workbook={payload.workbook}
                  onChange={(updated) =>
                    updateConfig(
                      payload.config.charts.map((item) =>
                        item.id === updated.id ? updated : item,
                      ),
                    )
                  }
                  onRemove={() =>
                    updateConfig(payload.config.charts.filter((item) => item.id !== chart.id))
                  }
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3 print:gap-0">
            <div className="flex items-center justify-between print:hidden">
              <div>
                <h2 className="text-lg font-semibold text-[#0b0b0b]">3. Prévia</h2>
                <p className="text-xs text-[#898781]">
                  O botão abre a janela de impressão do navegador, onde você vê o resultado
                  final e escolhe “Salvar como PDF”.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-md bg-[#0b0b0b] px-4 py-2 text-sm font-medium text-white"
              >
                Exportar PDF
              </button>
            </div>
            {/*
              A prévia é fixada na largura útil de uma folha A4 paisagem com as
              margens de 12mm do @page (273mm ≈ 1032px a 96dpi). Isso não é
              estético: o ResponsiveContainer do Recharts mede a largura em JS,
              e se a caixa mudasse de tamanho ao imprimir, os gráficos sairiam
              com a medida antiga. Igualando tela e papel, não há remedição.
              A borda fica transparente em vez de sumir, para o box model não
              mudar. O scroll horizontal atende telas estreitas.
            */}
            <div className="overflow-x-auto print:overflow-visible">
              <div className="w-[1032px] rounded-lg border border-[#e1e0d9] bg-white p-4 print:rounded-none print:border-transparent">
                <DashboardView payload={payload} />
              </div>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
