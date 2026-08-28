/**
 * Modelo do dashboard: o que o usuário customiza na tela e o que é
 * reproduzido fielmente no PDF.
 *
 * Um `ChartSpec` referencia colunas pela `key` do schema — nunca por índice
 * ou por posição na planilha —, então corrigir um tipo ou renomear um rótulo
 * na tela de revisão não invalida os gráficos já montados.
 */

import type { ParsedWorkbook } from "@/lib/parsing/types";

export type ChartType = "bar" | "line" | "area" | "pie" | "kpi" | "table";

export type Aggregation = "sum" | "avg" | "count" | "min" | "max";

export type DateGranularity = "day" | "month" | "year";

export interface ChartSpec {
  id: string;
  type: ChartType;
  title: string;
  tableKey: string;
  /** Coluna do eixo X / agrupamento. Null em KPI e tabela. */
  categoryKey: string | null;
  /** Colunas numéricas plotadas. Vazio significa "contar linhas". */
  valueKeys: string[];
  aggregation: Aggregation;
  /** Máximo de categorias exibidas. */
  limit: number;
  granularity?: DateGranularity;
  /** Por que este gráfico foi sugerido — exibido na UI de correção. */
  rationale: string;
  origin: "ai" | "heuristic" | "user";
}

export interface DashboardConfig {
  title: string;
  charts: ChartSpec[];
}

/**
 * Tudo o que a tela do dashboard (e o renderizador de PDF) precisam para
 * desenhar sem consultar o banco.
 */
export interface DashboardPayload {
  workbook: ParsedWorkbook;
  config: DashboardConfig;
}

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: "Barras",
  line: "Linha",
  area: "Área",
  pie: "Pizza",
  kpi: "Indicador",
  table: "Tabela",
};

export const AGGREGATION_LABELS: Record<Aggregation, string> = {
  sum: "Soma",
  avg: "Média",
  count: "Contagem",
  min: "Mínimo",
  max: "Máximo",
};
