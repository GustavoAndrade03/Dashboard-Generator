/**
 * Regras sobre o que é um gráfico válido.
 *
 * Mora fora dos componentes de propósito (CLAUDE.md, 11.10): o painel de
 * edição só desenha os controles, e a decisão de qual coluna pode ocupar qual
 * papel é testável sem montar React.
 */

import { distinctCategoryValues } from "@/lib/dashboard/aggregate";
import type {
  Aggregation,
  ChartFilter,
  ChartSpec,
  ChartType,
} from "@/lib/dashboard/types";
import type { ColumnSchema, ParsedTable } from "@/lib/parsing/types";

/**
 * Colunas que fazem sentido como eixo de agrupamento.
 *
 * `identifier` entra na lista: em quadros de indicadores a coluna da esquerda
 * tem um rótulo distinto por linha ("Presos Provisórios", "Brasil"), o que a
 * classifica como identificador — mas é justamente o eixo que o usuário quer.
 */
const CATEGORY_TYPES: ReadonlySet<string> = new Set([
  "date",
  "category",
  "boolean",
  "identifier",
]);

export function categoryColumns(table: ParsedTable | undefined): ColumnSchema[] {
  return table?.schema.columns.filter((column) => CATEGORY_TYPES.has(column.type)) ?? [];
}

export function numberColumns(table: ParsedTable | undefined): ColumnSchema[] {
  return table?.schema.columns.filter((column) => column.type === "number") ?? [];
}

/** Tipos que precisam de uma coluna de agrupamento para fazer sentido. */
export function needsCategory(type: ChartType): boolean {
  return type !== "kpi" && type !== "table";
}

/** Tipos em que empilhar as séries faz sentido. Linha empilhada não se lê. */
export function canStack(type: ChartType): boolean {
  return type === "bar" || type === "hbar" || type === "area";
}

/** Tipos que aceitam os controles de comparação. */
export function canCompare(type: ChartType): boolean {
  return needsCategory(type);
}

function defaultLimit(type: ChartType, category: ColumnSchema | undefined): number {
  if (type === "pie") return 6;
  if (type === "table") return 20;
  return category?.type === "date" ? 60 : 12;
}

/**
 * Mantém o recorte de indicadores coerente com os dados atuais.
 *
 * Se o usuário renomeia ou apaga a linha que estava selecionada, o recorte
 * ficaria apontando para o vazio e o gráfico sairia em branco sem explicação.
 * Nesse caso o filtro cai fora e volta a valer "todos" — degradação visível,
 * em vez de um gráfico misteriosamente vazio.
 */
function normalizeFilter(
  filter: ChartFilter | undefined,
  table: ParsedTable | undefined,
): ChartFilter | undefined {
  if (!filter || !table) return undefined;
  if (!table.schema.columns.some((column) => column.key === filter.columnKey)) return undefined;

  const disponiveis = new Set(distinctCategoryValues(table, filter.columnKey));
  const values = filter.values.filter((value) => disponiveis.has(value));
  return values.length === 0 ? undefined : { columnKey: filter.columnKey, values };
}

/**
 * Ajusta um gráfico depois de uma edição do usuário, para que ele nunca fique
 * numa combinação impossível — trocar para "Número" com três colunas
 * selecionadas, por exemplo. Preserva as escolhas que continuam válidas.
 */
/**
 * Mantém a lista de quadros comparados apontando para quadros que existem, e
 * nunca para o próprio quadro base — que já é a primeira série.
 */
function normalizeCompare(
  spec: ChartSpec,
  tables: readonly ParsedTable[] | undefined,
): string[] | undefined {
  if (!canCompare(spec.type) || !spec.compareTables || !tables) return undefined;
  const validos = spec.compareTables.filter(
    (key) => key !== spec.tableKey && tables.some((item) => item.schema.key === key),
  );
  return validos.length > 0 ? validos : undefined;
}

export function normalizeSpec(
  spec: ChartSpec,
  table: ParsedTable | undefined,
  tables?: readonly ParsedTable[],
): ChartSpec {
  const categorias = categoryColumns(table);
  const numeros = numberColumns(table);

  const valueKeys = spec.valueKeys.filter((key) => numeros.some((column) => column.key === key));
  let categoryKey = categorias.some((column) => column.key === spec.categoryKey)
    ? spec.categoryKey
    : null;

  if (needsCategory(spec.type)) {
    categoryKey ??= categorias[0]?.key ?? null;
  } else {
    categoryKey = null;
  }

  // Um indicador é um número só.
  const valores = spec.type === "kpi" ? valueKeys.slice(0, 1) : valueKeys;
  const category = categorias.find((column) => column.key === categoryKey);

  return {
    ...spec,
    categoryKey,
    valueKeys: valores,
    aggregation: valores.length === 0 ? "count" : spec.aggregation,
    limit: defaultLimit(spec.type, category),
    granularity: category?.type === "date" ? (spec.granularity ?? "month") : undefined,
    includeTotalRows: spec.includeTotalRows ?? false,
    filter: normalizeFilter(spec.filter, table),
    axis: needsCategory(spec.type) ? spec.axis : undefined,
    stacked: canStack(spec.type) ? spec.stacked : undefined,
    valueMode: needsCategory(spec.type) ? spec.valueMode : undefined,
    compareTables: normalizeCompare(spec, tables),
  };
}

/** Gráfico novo montado do zero, já com escolhas plausíveis preenchidas. */
export function createChart(table: ParsedTable, id: string): ChartSpec {
  const categoria = categoryColumns(table)[0];
  const numero = numberColumns(table)[0];

  return normalizeSpec(
    {
      id,
      type: categoria?.type === "date" ? "line" : "bar",
      title: numero && categoria ? `${numero.label} por ${categoria.label}` : "Novo gráfico",
      tableKey: table.schema.key,
      categoryKey: categoria?.key ?? null,
      valueKeys: numero ? [numero.key] : [],
      aggregation: numero ? "sum" : "count",
      limit: 12,
      rationale: "",
      origin: "user",
    },
    table,
  );
}

export const AGGREGATIONS: readonly Aggregation[] = ["sum", "avg", "count", "min", "max"];

export const CHART_TYPES: readonly ChartType[] = [
  "bar",
  "hbar",
  "line",
  "area",
  "pie",
  "kpi",
  "table",
];
