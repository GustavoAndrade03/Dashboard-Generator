/**
 * Agregação dos dados normalizados para o formato que o Recharts consome.
 *
 * Vive fora de /components de propósito: a mesma função alimenta o editor na
 * tela e a impressão, o que é o que garante que o PDF saia idêntico ao que o
 * usuário viu (CLAUDE.md, seção 7.3).
 *
 * Os três níveis de um relatório em matriz (quadro, indicador, unidade) são
 * resolvidos aqui: o quadro é `tableKey`, o indicador é recortado por
 * `spec.filter` e as unidades são as `valueKeys`.
 */

import type { Aggregation, ChartSpec, DateGranularity } from "@/lib/dashboard/types";
import type { CellValue, ParsedTable, ParsedWorkbook } from "@/lib/parsing/types";

export interface ChartSeries {
  key: string;
  label: string;
}

export interface ChartDatum {
  label: string;
  [seriesKey: string]: string | number | boolean | null;
}

export interface ChartData {
  categoryLabel: string;
  series: ChartSeries[];
  rows: ChartDatum[];
  /** Preenchido apenas em gráficos do tipo KPI. */
  kpi?: { label: string; value: number | null };
  /** Mensagem legível quando o gráfico não pôde ser montado. */
  error?: string;
}

export function findTable(workbook: ParsedWorkbook, tableKey: string): ParsedTable | undefined {
  return workbook.tables.find((table) => table.schema.key === tableKey);
}

function columnIndex(table: ParsedTable, key: string): number {
  return table.schema.columns.findIndex((column) => column.key === key);
}

function aggregateValues(values: number[], aggregation: Aggregation): number | null {
  if (aggregation === "count") return values.length;
  if (values.length === 0) return null;
  switch (aggregation) {
    case "sum":
      return values.reduce((total, value) => total + value, 0);
    case "avg":
      return values.reduce((total, value) => total + value, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
  }
}

/** Agrupa datas ISO no bucket pedido e devolve uma chave ordenável. */
function dateBucket(value: string, granularity: DateGranularity): string {
  if (granularity === "year") return value.slice(0, 4);
  if (granularity === "month") return value.slice(0, 7);
  return value.slice(0, 10);
}

function formatBucketLabel(bucket: string, granularity: DateGranularity): string {
  if (granularity === "year") return bucket;
  if (granularity === "month") {
    const [year, month] = bucket.split("-");
    return `${month}/${year}`;
  }
  const [year, month, day] = bucket.split("-");
  return `${day}/${month}/${year}`;
}

const TOTAL_ROW = /^\s*(sub)?total/i;

/** "Subtotal", "TOTAL GERAL": o fechamento de um quadro, não uma categoria. */
function isTotalRow(value: CellValue): boolean {
  return typeof value === "string" && TOTAL_ROW.test(value);
}

function cellToText(value: CellValue): string {
  if (value === null || value === "") return "(vazio)";
  return String(value);
}

/**
 * Aplica o recorte de indicadores. Vale para todos os formatos, inclusive KPI
 * e tabela — é o que permite "o déficit de vagas do PAMC" ser um número só.
 */
function filteredRows(table: ParsedTable, spec: ChartSpec): CellValue[][] {
  const filtro = spec.filter;
  if (!filtro || filtro.values.length === 0) return table.rows;

  const index = columnIndex(table, filtro.columnKey);
  if (index < 0) return table.rows;

  const mantidos = new Set(filtro.values);
  return table.rows.filter((row) => mantidos.has(cellToText(row[index])));
}

export function distinctCategoryValues(table: ParsedTable, columnKey: string): string[] {
  const index = table.schema.columns.findIndex((column) => column.key === columnKey);
  if (index < 0) return [];

  const vistos = new Set<string>();
  const valores: string[] = [];
  for (const row of table.rows) {
    const texto = cellToText(row[index]);
    if (vistos.has(texto)) continue;
    vistos.add(texto);
    valores.push(texto);
  }
  return valores;
}

export function buildChartData(workbook: ParsedWorkbook, spec: ChartSpec): ChartData {
  const table = findTable(workbook, spec.tableKey);
  if (!table) {
    return { categoryLabel: "", series: [], rows: [], error: "Quadro não encontrado." };
  }

  const rows = filteredRows(table, spec);
  const valueColumns = spec.valueKeys
    .map((key) => ({ key, index: columnIndex(table, key) }))
    .filter((column) => column.index >= 0)
    .map((column) => ({ ...column, schema: table.schema.columns[column.index] }));

  if (spec.type === "kpi") {
    const column = valueColumns[0];
    if (!column) {
      return { categoryLabel: "", series: [], rows: [], error: "Nenhuma coluna selecionada." };
    }
    const numbers = rows
      .map((row) => row[column.index])
      .filter((value): value is number => typeof value === "number");

    // Com o recorte em um único indicador, ele é que nomeia o número.
    const recorte = spec.filter?.values.length === 1 ? spec.filter.values[0] : null;
    return {
      categoryLabel: "",
      series: [],
      rows: [],
      kpi: {
        label: recorte ? `${recorte} · ${column.schema.label}` : column.schema.label,
        value: aggregateValues(numbers, spec.aggregation),
      },
    };
  }

  if (spec.type === "table") {
    /**
     * A coluna descritiva do quadro — o rótulo da esquerda, "DÉFICIT DE VAGAS".
     * Sem ela a tabela é uma parede de números sem dizer de que são, que é
     * exatamente o que ela deveria resolver.
     */
    const descriptorIdx = table.schema.columns.findIndex(
      (column) => column.type !== "number" && column.type !== "empty",
    );
    const escolhidas =
      valueColumns.length > 0
        ? valueColumns
        : table.schema.columns.map((schema, index) => ({ key: schema.key, index, schema }));
    // Ela vira a primeira coluna; repeti-la entre os valores seria duplicata.
    const columns = escolhidas.filter((column) => column.index !== descriptorIdx);

    const datums: ChartDatum[] = rows.slice(0, spec.limit).map((row, rowIndex) => {
      const datum: ChartDatum = {
        label: descriptorIdx >= 0 ? cellToText(row[descriptorIdx]) : String(rowIndex + 1),
      };
      for (const column of columns) datum[column.key] = row[column.index] ?? null;
      return datum;
    });

    return {
      categoryLabel: descriptorIdx >= 0 ? table.schema.columns[descriptorIdx].label : "",
      series: columns.map((column) => ({ key: column.key, label: column.schema.label })),
      rows: datums,
    };
  }

  const categoryIdx = spec.categoryKey ? columnIndex(table, spec.categoryKey) : -1;
  if (categoryIdx < 0) {
    return {
      categoryLabel: "",
      series: [],
      rows: [],
      error: "Coluna de agrupamento não encontrada.",
    };
  }
  const categorySchema = table.schema.columns[categoryIdx];
  const granularity: DateGranularity = spec.granularity ?? "month";
  const isDate = categorySchema.type === "date";

  // bucket -> coluna -> valores numéricos coletados
  const buckets = new Map<string, Map<string, number[]>>();
  const bucketOrder: string[] = [];

  for (const row of rows) {
    const rawCategory = row[categoryIdx];
    if (!spec.includeTotalRows && isTotalRow(rawCategory)) continue;
    const bucket =
      isDate && typeof rawCategory === "string"
        ? dateBucket(rawCategory, granularity)
        : cellToText(rawCategory);

    let entry = buckets.get(bucket);
    if (!entry) {
      entry = new Map<string, number[]>();
      buckets.set(bucket, entry);
      bucketOrder.push(bucket);
    }

    if (valueColumns.length === 0) {
      const counter = entry.get("__count") ?? [];
      counter.push(1);
      entry.set("__count", counter);
      continue;
    }

    for (const column of valueColumns) {
      const value = row[column.index];
      if (typeof value !== "number") continue;
      const values = entry.get(column.key) ?? [];
      values.push(value);
      entry.set(column.key, values);
    }
  }

  const series: ChartSeries[] =
    valueColumns.length === 0
      ? [{ key: "__count", label: "Quantidade" }]
      : valueColumns.map((column) => ({ key: column.key, label: column.schema.label }));

  const aggregation: Aggregation = valueColumns.length === 0 ? "count" : spec.aggregation;

  /**
   * Um indicador só, várias unidades: o eixo teria uma categoria e a leitura
   * ficaria toda na legenda. Nesse caso as unidades viram o eixo — é o gráfico
   * que o usuário quis dizer ao pedir "déficit de vagas por unidade".
   */
  if (bucketOrder.length === 1 && series.length > 1) {
    const entry = buckets.get(bucketOrder[0]);
    const porUnidade: ChartDatum[] = series.map((item) => ({
      label: item.label,
      valor: aggregateValues(entry?.get(item.key) ?? [], aggregation),
    }));
    return {
      categoryLabel: bucketOrder[0],
      series: [{ key: "valor", label: bucketOrder[0] }],
      rows: porUnidade.slice(0, spec.limit),
    };
  }

  const entries = bucketOrder.map((bucket) => {
    const values = buckets.get(bucket);
    const datum: ChartDatum = {
      label: isDate ? formatBucketLabel(bucket, granularity) : bucket,
    };
    for (const item of series) {
      datum[item.key] = aggregateValues(values?.get(item.key) ?? [], aggregation);
    }
    // A chave de ordenação (o bucket cru) fica fora do datum para não vazar
    // como uma série extra para o Recharts.
    return { bucket, datum };
  });

  if (isDate) {
    // Séries temporais em ordem cronológica; categorias, por magnitude.
    entries.sort((a, b) => a.bucket.localeCompare(b.bucket));
  } else {
    const primary = series[0].key;
    entries.sort((a, b) => Number(b.datum[primary] ?? 0) - Number(a.datum[primary] ?? 0));
  }

  return {
    categoryLabel: categorySchema.label,
    series,
    rows: entries.slice(0, spec.limit).map((entry) => entry.datum),
  };
}
