/**
 * Sugestão de gráficos puramente determinística — sem IA, sem custo.
 *
 * Serve a dois propósitos: é o resultado usado quando a chamada à Camada 2
 * falha ou não está configurada, e é a garantia de que o produto continua
 * utilizável sem depender de nenhum provedor externo (CLAUDE.md, seção 4.1).
 */

import type { ChartSpec } from "@/lib/dashboard/types";
import type { SchemaSummary, SchemaSummaryColumn, SchemaSummaryTable } from "@/lib/parsing/schema-builder";

const MAX_CHARTS = 6;
/** Acima disso, um gráfico de barras vira uma parede ilegível. */
const MAX_CATEGORY_CARDINALITY = 25;
const MAX_PIE_CARDINALITY = 6;

function isPlottableNumber(column: SchemaSummaryColumn): boolean {
  return column.type === "number";
}

function isUsableCategory(column: SchemaSummaryColumn): boolean {
  return (
    column.type === "category" &&
    column.distinctCount > 1 &&
    column.distinctCount <= MAX_CATEGORY_CARDINALITY
  );
}

function chartsForTable(table: SchemaSummaryTable, offset: number): ChartSpec[] {
  const charts: ChartSpec[] = [];
  const dates = table.columns.filter((column) => column.type === "date");
  const numbers = table.columns.filter(isPlottableNumber);
  const categories = table.columns.filter(isUsableCategory);

  const nextId = () => `${table.key}-${offset + charts.length}`;

  // Data + número é o padrão mais forte: série temporal.
  if (dates.length > 0 && numbers.length > 0) {
    charts.push({
      id: nextId(),
      type: "line",
      title: `${numbers[0].label} ao longo do tempo`,
      tableKey: table.key,
      categoryKey: dates[0].key,
      valueKeys: [numbers[0].key],
      aggregation: "sum",
      limit: 60,
      granularity: "month",
      rationale: `A coluna "${dates[0].label}" é uma data e "${numbers[0].label}" é numérica.`,
      origin: "heuristic",
    });
  }

  // Categoria de baixa cardinalidade + número: comparação por barras.
  if (categories.length > 0 && numbers.length > 0) {
    charts.push({
      id: nextId(),
      type: "bar",
      title: `${numbers[0].label} por ${categories[0].label}`,
      tableKey: table.key,
      categoryKey: categories[0].key,
      valueKeys: [numbers[0].key],
      aggregation: "sum",
      limit: 12,
      rationale: `"${categories[0].label}" tem ${categories[0].distinctCount} valores distintos, bom para comparar.`,
      origin: "heuristic",
    });
  }

  // Poucas categorias: composição faz sentido como pizza.
  const pieCategory = categories.find((column) => column.distinctCount <= MAX_PIE_CARDINALITY);
  if (pieCategory && numbers.length > 0) {
    charts.push({
      id: nextId(),
      type: "pie",
      title: `Composição de ${numbers[0].label} por ${pieCategory.label}`,
      tableKey: table.key,
      categoryKey: pieCategory.key,
      valueKeys: [numbers[0].key],
      aggregation: "sum",
      limit: MAX_PIE_CARDINALITY,
      rationale: `"${pieCategory.label}" tem poucas categorias, adequado para participação no total.`,
      origin: "heuristic",
    });
  }

  // Um total sempre ajuda a ancorar a leitura do dashboard.
  if (numbers.length > 0) {
    charts.push({
      id: nextId(),
      type: "kpi",
      title: `Total de ${numbers[0].label}`,
      tableKey: table.key,
      categoryKey: null,
      valueKeys: [numbers[0].key],
      aggregation: "sum",
      limit: 1,
      rationale: `Soma da coluna numérica "${numbers[0].label}".`,
      origin: "heuristic",
    });
  }

  // Sem nenhuma coluna numérica, resta contar ocorrências.
  if (numbers.length === 0 && categories.length > 0) {
    charts.push({
      id: nextId(),
      type: "bar",
      title: `Quantidade por ${categories[0].label}`,
      tableKey: table.key,
      categoryKey: categories[0].key,
      valueKeys: [],
      aggregation: "count",
      limit: 12,
      rationale: `Não há colunas numéricas; contagem de linhas por "${categories[0].label}".`,
      origin: "heuristic",
    });
  }

  return charts;
}

export function buildHeuristicCharts(summary: SchemaSummary): ChartSpec[] {
  const charts: ChartSpec[] = [];
  for (const table of summary.tables) {
    for (const chart of chartsForTable(table, charts.length)) {
      if (charts.length >= MAX_CHARTS) return charts;
      charts.push(chart);
    }
  }
  return charts;
}
