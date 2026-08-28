/**
 * Orquestra a Camada 1: grade bruta -> tabela normalizada + schema.
 *
 * `buildSchemaSummary` produz o resumo compacto que é o ÚNICO insumo enviado
 * à Camada 2 (IA). Dados brutos nunca saem daqui — ver CLAUDE.md, seções 4.2
 * e 7.4.
 */

import type { DataSourceDescriptor, RawTable } from "@/lib/data-sources/types";
import { detectHeader } from "@/lib/parsing/detect-headers";
import { buildColumnStats, coerceValue, inferColumnType } from "@/lib/parsing/infer-types";
import { normalizeGrid } from "@/lib/parsing/normalize";
import type {
  CellValue,
  ColumnSchema,
  ColumnType,
  ParsedTable,
  ParsedWorkbook,
} from "@/lib/parsing/types";

/**
 * Teto de linhas materializadas por tabela. Os dados são guardados como JSON
 * no Postgres (ver prisma/schema.prisma), então vale limitar o volume — a
 * escala do projeto é de dezenas de milhares de linhas, não milhões.
 */
export const MAX_ROWS_PER_TABLE = 20000;

const SAMPLE_SIZE = 5;
/** Amostras enviadas à IA por coluna. Mantido baixo de propósito: custo e privacidade. */
const AI_SAMPLE_SIZE = 3;
const AI_MAX_COLUMNS = 40;
const AI_MAX_TABLES = 5;

function pickSamples(values: CellValue[], limit: number): string[] {
  const samples: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (value === null || value === "") continue;
    const text = String(value);
    if (seen.has(text)) continue;
    seen.add(text);
    samples.push(text);
    if (samples.length >= limit) break;
  }
  return samples;
}

export function buildParsedTable(table: RawTable, tableIndex: number): ParsedTable {
  const warnings: string[] = [];
  const grid = normalizeGrid(table);
  const header = detectHeader(grid.cells, grid.columnIndexes);

  if (header.rowIndex === null) {
    warnings.push(
      "Não foi possível identificar uma linha de cabeçalho; os nomes das colunas foram gerados automaticamente.",
    );
  } else if (header.confidence < 0.7) {
    warnings.push("O cabeçalho detectado tem confiança baixa — vale conferir.");
  }

  let dataRows = grid.cells.slice(header.dataStartRow);
  if (dataRows.length > MAX_ROWS_PER_TABLE) {
    warnings.push(
      `A aba tem ${dataRows.length} linhas; apenas as primeiras ${MAX_ROWS_PER_TABLE} foram carregadas.`,
    );
    dataRows = dataRows.slice(0, MAX_ROWS_PER_TABLE);
  }

  const columns: ColumnSchema[] = grid.columnIndexes.map((sourceIndex, columnIndex) => {
    const rawValues = dataRows.map((row) => row[columnIndex] ?? null);
    const inference = inferColumnType(rawValues);
    const values = rawValues.map((value) => coerceValue(value, inference.type));
    return {
      key: `c${sourceIndex}`,
      label: header.labels[columnIndex] ?? `Coluna ${columnIndex + 1}`,
      sourceIndex,
      type: inference.type,
      confidence: Number(inference.confidence.toFixed(2)),
      stats: buildColumnStats(values, inference.type),
      sampleValues: pickSamples(values, SAMPLE_SIZE),
    };
  });

  const rows = dataRows.map((row) =>
    columns.map((column, columnIndex) => coerceValue(row[columnIndex] ?? null, column.type)),
  );

  if (columns.length > 0 && rows.length === 0) {
    warnings.push("Nenhuma linha de dados foi encontrada abaixo do cabeçalho.");
  }

  return {
    schema: {
      key: `t${tableIndex}`,
      label: table.name,
      headerRowIndex: header.rowIndex,
      headerConfidence: Number(header.confidence.toFixed(2)),
      rowCount: rows.length,
      columns,
      warnings,
    },
    rows,
  };
}

export function buildParsedWorkbook(
  source: DataSourceDescriptor,
  tables: RawTable[],
): ParsedWorkbook {
  return {
    source,
    tables: tables
      .map((table, index) => buildParsedTable(table, index))
      // Abas sem nenhuma coluna aproveitável só poluiriam a revisão.
      .filter((parsed) => parsed.schema.columns.length > 0),
  };
}

/** Reaplica os tipos após o usuário corrigir a inferência na tela de revisão. */
export function applyTypeOverrides(
  table: ParsedTable,
  overrides: Record<string, ColumnType>,
): ParsedTable {
  const columns = table.schema.columns.map((column) => {
    const type = overrides[column.key];
    return type && type !== column.type ? { ...column, type, confidence: 1 } : column;
  });

  const rows = table.rows.map((row) =>
    columns.map((column, index) => coerceValue(row[index], column.type)),
  );

  const withStats = columns.map((column, index) => ({
    ...column,
    stats: buildColumnStats(
      rows.map((row) => row[index]),
      column.type,
    ),
    sampleValues: pickSamples(
      rows.map((row) => row[index]),
      SAMPLE_SIZE,
    ),
  }));

  return { schema: { ...table.schema, columns: withStats }, rows };
}

export interface SchemaSummaryColumn {
  key: string;
  label: string;
  type: ColumnType;
  distinctCount: number;
  samples: string[];
}

export interface SchemaSummaryTable {
  key: string;
  label: string;
  rowCount: number;
  columns: SchemaSummaryColumn[];
}

export interface SchemaSummary {
  tables: SchemaSummaryTable[];
}

/**
 * Resumo estruturado para a Camada 2. Propositalmente pequeno: sem linhas
 * completas, poucas amostras por coluna e limites rígidos de tamanho.
 */
export function buildSchemaSummary(workbook: ParsedWorkbook): SchemaSummary {
  return {
    tables: workbook.tables.slice(0, AI_MAX_TABLES).map((table) => ({
      key: table.schema.key,
      label: table.schema.label,
      rowCount: table.schema.rowCount,
      columns: table.schema.columns.slice(0, AI_MAX_COLUMNS).map((column) => ({
        key: column.key,
        label: column.label,
        type: column.type,
        distinctCount: column.stats.distinctCount,
        samples: column.sampleValues.slice(0, AI_SAMPLE_SIZE),
      })),
    })),
  };
}
