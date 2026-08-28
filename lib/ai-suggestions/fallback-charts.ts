/**
 * Sugestão de gráficos puramente determinística — sem IA, sem custo.
 *
 * Serve a dois propósitos: é o resultado usado quando a chamada à Camada 2
 * falha ou não está configurada, e é a garantia de que o produto continua
 * utilizável sem depender de nenhum provedor externo (CLAUDE.md, 4.1).
 */

import type { ChartSpec } from "@/lib/dashboard/types";
import type {
  SchemaSummary,
  SchemaSummaryColumn,
  SchemaSummaryTable,
} from "@/lib/parsing/schema-builder";

const MAX_CHARTS = 6;
/** Acima disso, um gráfico de barras vira uma parede ilegível. */
const MAX_CATEGORY_CARDINALITY = 25;
const MAX_PIE_CARDINALITY = 6;
/** Quadros com poucas linhas comparam unidades entre si, não linhas entre si. */
const MAX_ROWS_FOR_UNIT_COMPARISON = 2;

function isPlottableNumber(column: SchemaSummaryColumn): boolean {
  return column.type === "number";
}

/** Colunas de fechamento não devem ser somadas junto com as parcelas. */
function isTotalColumn(column: SchemaSummaryColumn): boolean {
  return /^\**\s*(total|subtotal)/i.test(column.label.trim());
}

/**
 * Serve como eixo de agrupamento. Inclui `identifier` de propósito: em quadros
 * de indicadores a coluna da esquerda tem um rótulo distinto por linha ("Presos
 * Provisórios", "Brasil"), o que a classifica como identificador — mas é
 * exatamente o eixo que o usuário quer ver.
 */
function isUsableCategory(column: SchemaSummaryColumn): boolean {
  if (column.type === "category" || column.type === "identifier") {
    return column.distinctCount > 1 && column.distinctCount <= MAX_CATEGORY_CARDINALITY;
  }
  return false;
}

/** O total resume o quadro; as parcelas por unidade vêm depois. */
function preferredValue(numbers: SchemaSummaryColumn[]): SchemaSummaryColumn | undefined {
  return numbers.find(isTotalColumn) ?? numbers[0];
}

/**
 * Quando o valor plotado é a coluna de fechamento, o nome dela não diz nada
 * ("Total de TOTAL"). Quem descreve o gráfico é a faixa de título do quadro,
 * que é a frase que o próprio usuário escreveu na planilha.
 */
function tituloDoQuadro(table: SchemaSummaryTable, valor: SchemaSummaryColumn, sufixo: string) {
  return isTotalColumn(valor) ? `${sufixo}${table.label}` : null;
}

function chartsForTable(table: SchemaSummaryTable, offset: number): ChartSpec[] {
  const charts: ChartSpec[] = [];
  const dates = table.columns.filter((column) => column.type === "date");
  const numbers = table.columns.filter(isPlottableNumber);
  const parcelas = numbers.filter((column) => !isTotalColumn(column));
  const categories = table.columns.filter(isUsableCategory);
  const valor = preferredValue(numbers);

  const nextId = () => `${table.key}-${offset + charts.length}`;

  // Data + número é o padrão mais forte: série temporal.
  if (dates.length > 0 && valor) {
    charts.push({
      id: nextId(),
      type: "line",
      title: tituloDoQuadro(table, valor, "") ?? `${valor.label} ao longo do tempo`,
      tableKey: table.key,
      categoryKey: dates[0].key,
      valueKeys: [valor.key],
      aggregation: "sum",
      limit: 60,
      granularity: "month",
      rationale: `A coluna "${dates[0].label}" é uma data e "${valor.label}" é numérica.`,
      origin: "heuristic",
    });
  }

  // Quadro de uma ou duas linhas: o que interessa é comparar as colunas entre si.
  if (
    table.rowCount <= MAX_ROWS_FOR_UNIT_COMPARISON &&
    parcelas.length >= 3 &&
    categories.length > 0
  ) {
    charts.push({
      id: nextId(),
      type: "bar",
      title: table.label,
      tableKey: table.key,
      categoryKey: categories[0].key,
      valueKeys: parcelas.map((column) => column.key),
      aggregation: "sum",
      limit: 12,
      rationale: `Compara ${parcelas.length} colunas do quadro lado a lado.`,
      origin: "heuristic",
    });
  }

  // Categoria + número: comparação por barras.
  if (categories.length > 0 && valor && table.rowCount > MAX_ROWS_FOR_UNIT_COMPARISON) {
    charts.push({
      id: nextId(),
      type: "bar",
      title: tituloDoQuadro(table, valor, "") ?? `${valor.label} por ${categories[0].label}`,
      tableKey: table.key,
      categoryKey: categories[0].key,
      valueKeys: [valor.key],
      aggregation: "sum",
      limit: 12,
      rationale: `"${categories[0].label}" tem ${categories[0].distinctCount} valores distintos, bom para comparar.`,
      origin: "heuristic",
    });
  }

  // Poucas categorias: composição faz sentido como pizza.
  const pieCategory = categories.find((column) => column.distinctCount <= MAX_PIE_CARDINALITY);
  if (pieCategory && valor && table.rowCount > MAX_ROWS_FOR_UNIT_COMPARISON) {
    charts.push({
      id: nextId(),
      type: "pie",
      title:
        tituloDoQuadro(table, valor, "Composição — ") ??
        `Composição de ${valor.label} por ${pieCategory.label}`,
      tableKey: table.key,
      categoryKey: pieCategory.key,
      valueKeys: [valor.key],
      aggregation: "sum",
      limit: MAX_PIE_CARDINALITY,
      rationale: `"${pieCategory.label}" tem poucas categorias, adequado para participação no total.`,
      origin: "heuristic",
    });
  }

  // Um total sempre ajuda a ancorar a leitura do dashboard.
  if (valor) {
    charts.push({
      id: nextId(),
      type: "kpi",
      title: tituloDoQuadro(table, valor, "Total — ") ?? `Total de ${valor.label}`,
      tableKey: table.key,
      categoryKey: null,
      valueKeys: [valor.key],
      aggregation: "sum",
      limit: 1,
      rationale: `Soma da coluna numérica "${valor.label}".`,
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
  // Uma volta por tabela antes de aprofundar em qualquer uma: numa planilha com
  // oito quadros, seis gráficos do primeiro deixariam os outros invisíveis.
  const porTabela = summary.tables.map((table, index) => chartsForTable(table, index * 10));

  for (let rodada = 0; charts.length < MAX_CHARTS; rodada++) {
    const restam = porTabela.some((lista) => lista.length > rodada);
    if (!restam) break;
    for (const lista of porTabela) {
      if (charts.length >= MAX_CHARTS) break;
      if (lista[rodada]) charts.push(lista[rodada]);
    }
  }

  return charts;
}
