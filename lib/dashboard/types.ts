/**
 * Modelo do dashboard: o que o usuário customiza na tela e o que é impresso.
 *
 * `DashboardConfig` é um objeto serializável único (CLAUDE.md, 11.10):
 * gráficos, posições, template, paleta e títulos. É o que vai para a coluna
 * Json do Postgres e o que a impressão consome, sem transformação adicional.
 *
 * Um `ChartSpec` referencia colunas pela `key` do schema — nunca por índice ou
 * posição na planilha —, então corrigir um tipo ou renomear um rótulo na
 * revisão não invalida os gráficos já montados.
 */

import type { PaletteId } from "@/lib/dashboard/palettes";
import type { ParsedWorkbook } from "@/lib/parsing/types";

export type ChartType = "bar" | "line" | "area" | "pie" | "kpi" | "table";

export type Aggregation = "sum" | "avg" | "count" | "min" | "max";

export type DateGranularity = "day" | "month" | "year";

/**
 * Recorte de linhas do quadro.
 *
 * Os relatórios têm três níveis: o quadro ("População prisional em cumprimento
 * de pena"), o indicador na coluna da esquerda ("Déficit de vagas") e as
 * unidades nas colunas (PAMC, CPMBV, TOTAL). O quadro é o `tableKey` e as
 * unidades são as `valueKeys`; este filtro é o nível do meio.
 *
 * `values` vazio significa "todos" — assim um indicador novo, acrescentado na
 * edição de valores, entra sozinho em vez de ficar invisível.
 */
export interface ChartFilter {
  columnKey: string;
  values: string[];
}

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
  /**
   * Linhas de fechamento ("Subtotal", "TOTAL") ficam de fora por padrão:
   * plotar o todo ao lado das partes achata todas as barras. O usuário liga
   * quando quiser.
   */
  includeTotalRows?: boolean;
  /** Mostra apenas alguns indicadores do quadro. Ausente = todos. */
  filter?: ChartFilter;
  /** Por que este gráfico foi sugerido — exibido ao adicioná-lo. */
  rationale: string;
  origin: "ai" | "heuristic" | "user";
}

/** Posição na grade, em unidades de coluna/linha (não em pixels). */
export interface ChartLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Um gráfico já posicionado na folha. */
export interface PlacedChart extends ChartSpec {
  layout: ChartLayout;
}

export interface DashboardConfig {
  title: string;
  templateId: string;
  paletteId: PaletteId;
  charts: PlacedChart[];
}

/** Tudo o que a folha precisa para se desenhar, na tela ou no papel. */
export interface DashboardPayload {
  workbook: ParsedWorkbook;
  config: DashboardConfig;
}

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: "Barras",
  line: "Linha",
  area: "Área",
  pie: "Pizza",
  kpi: "Número",
  table: "Tabela",
};

/** Explicações sem jargão, para o seletor de tipo (CLAUDE.md, 11.9). */
export const CHART_TYPE_HINTS: Record<ChartType, string> = {
  bar: "Comparar valores entre categorias",
  line: "Acompanhar a evolução ao longo do tempo",
  area: "Evolução destacando o volume acumulado",
  pie: "Mostrar quanto cada parte representa do total",
  kpi: "Destacar um número só",
  table: "Mostrar os valores em linhas e colunas",
};

export const AGGREGATION_LABELS: Record<Aggregation, string> = {
  sum: "Somar",
  avg: "Tirar a média",
  count: "Contar",
  min: "Menor valor",
  max: "Maior valor",
};
