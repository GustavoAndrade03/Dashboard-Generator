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
import type { SheetThemeId } from "@/lib/dashboard/themes";
import type { ParsedWorkbook } from "@/lib/parsing/types";

export type ChartType = "bar" | "hbar" | "line" | "area" | "pie" | "kpi" | "table";

export type Aggregation = "sum" | "avg" | "count" | "min" | "max";

export type DateGranularity = "day" | "month" | "year";

/**
 * Quem ocupa o eixo do gráfico.
 *
 * Num relatório em matriz há duas leituras da mesma tabela: comparar
 * indicadores dentro de uma unidade ("rows") ou comparar unidades dentro de um
 * indicador ("columns"). São perguntas diferentes sobre os mesmos números, e o
 * usuário escolhe qual está fazendo.
 *
 * Ausente significa automático: indicadores no eixo, a menos que o recorte
 * tenha deixado um só — aí as unidades assumem, senão o gráfico teria uma
 * categoria única e toda a leitura ficaria na legenda.
 */
export type ChartAxis = "rows" | "columns";

/** Valor absoluto ou participação no conjunto mostrado. */
export type ValueMode = "absolute" | "percent";

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
  /** Quem vai para o eixo. Ausente = automático (ver ChartAxis). */
  axis?: ChartAxis;
  /**
   * Empilha as séries em vez de pô-las lado a lado. Muda a pergunta que o
   * gráfico responde: de "qual é maior" para "quanto cada uma é do todo".
   */
  stacked?: boolean;
  /** Absoluto ou porcentagem do conjunto mostrado. Ausente = absoluto. */
  valueMode?: ValueMode;
  /**
   * Outros quadros comparados no mesmo gráfico. Cada quadro vira uma série, e
   * as colunas são casadas pelo rótulo — "PAMC" de um quadro com "PAMC" do
   * outro —, porque a chave de coluna é local a cada tabela.
   */
  compareTables?: string[];
  /** Por que este gráfico foi sugerido — exibido ao adicioná-lo. */
  rationale: string;
  origin: "ai" | "heuristic" | "user";
}

/** Posição na grade, em unidades de coluna/linha (não em pixels). */
export interface ChartLayout {
  /** Folha em que o gráfico está, a partir de 0. Cada folha é uma página do PDF. */
  page: number;
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
  /** Papel e tinta da folha. Vive na config para não divergir do PDF. */
  themeId: SheetThemeId;
  charts: PlacedChart[];
}

/** Tudo o que a folha precisa para se desenhar, na tela ou no papel. */
export interface DashboardPayload {
  workbook: ParsedWorkbook;
  config: DashboardConfig;
}

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: "Barras",
  hbar: "Barras deitadas",
  line: "Linha",
  area: "Área",
  pie: "Pizza",
  kpi: "Número",
  table: "Tabela",
};

/** Explicações sem jargão, para o seletor de tipo (CLAUDE.md, 11.9). */
export const CHART_TYPE_HINTS: Record<ChartType, string> = {
  bar: "Comparar valores entre categorias",
  hbar: "Comparar categorias de nome comprido, que não cabem embaixo da barra",
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
