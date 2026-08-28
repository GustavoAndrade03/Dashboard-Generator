/**
 * Orquestra a Camada 1: aba bruta -> um ou mais blocos normalizados + schema.
 *
 * Uma aba pode conter vários quadros empilhados (ver `split-blocks.ts`), então
 * a unidade de saída é o **bloco**, não a aba.
 *
 * `buildSchemaSummary` produz o resumo compacto que é o ÚNICO insumo enviado à
 * Camada 2 (IA). Dados brutos nunca saem daqui — ver CLAUDE.md, 4.2 e 7.4.
 */

import type { DataSourceDescriptor, RawTable, RawValue } from "@/lib/data-sources/types";
import { detectHeader } from "@/lib/parsing/detect-headers";
import { buildColumnStats, coerceValue, inferColumnType } from "@/lib/parsing/infer-types";
import { trimEmpty } from "@/lib/parsing/normalize";
import { prepareSheet, splitIntoBlocks } from "@/lib/parsing/split-blocks";
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
const AI_MAX_TABLES = 8;

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

interface TableSource {
  key: string;
  label: string;
  sheetName: string;
  cells: RawValue[][];
  columnIndexes: number[];
}

function buildFromCells(source: TableSource): ParsedTable {
  const warnings: string[] = [];
  const header = detectHeader(source.cells, source.columnIndexes);

  if (header.rowIndex === null) {
    warnings.push(
      "Não foi possível identificar uma linha de cabeçalho; os nomes das colunas foram gerados automaticamente.",
    );
  } else if (header.confidence < 0.7) {
    warnings.push("O cabeçalho detectado tem confiança baixa — vale conferir.");
  }

  let dataRows = source.cells.slice(header.dataStartRow);
  if (dataRows.length > MAX_ROWS_PER_TABLE) {
    warnings.push(
      `A tabela tem ${dataRows.length} linhas; apenas as primeiras ${MAX_ROWS_PER_TABLE} foram carregadas.`,
    );
    dataRows = dataRows.slice(0, MAX_ROWS_PER_TABLE);
  }

  const columns: ColumnSchema[] = source.columnIndexes.map((sourceIndex, columnIndex) => {
    const rawValues = dataRows.map((row) => row[columnIndex] ?? null);
    const inference = inferColumnType(rawValues);
    const values = rawValues.map((value) => coerceValue(value, inference.type));

    // Em quadros de indicadores a primeira coluna costuma ter o cabeçalho
    // vazio (as unidades ocupam o topo) e o nome do indicador nas linhas.
    // "Coluna A" não diria nada ao usuário.
    const gerado = header.labels[columnIndex] ?? "";
    const semNome = gerado.startsWith("Coluna ");
    const rotulo =
      columnIndex === 0 && semNome && (inference.type === "category" || inference.type === "identifier")
        ? "Indicador"
        : gerado || `Coluna ${columnIndex + 1}`;

    return {
      key: `c${sourceIndex}`,
      label: rotulo,
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
      key: source.key,
      label: source.label,
      sheetName: source.sheetName,
      headerRowIndex: header.rowIndex,
      headerConfidence: Number(header.confidence.toFixed(2)),
      rowCount: rows.length,
      columns,
      warnings,
    },
    rows,
  };
}

/** Lê a aba inteira como uma tabela só. Útil para planilhas simples e testes. */
export function buildParsedTable(table: RawTable, tableIndex: number): ParsedTable {
  const sheet = prepareSheet(table);
  const grid = trimEmpty(sheet.cells, sheet.columnIndexes);
  return buildFromCells({
    key: `t${tableIndex}`,
    label: table.name,
    sheetName: table.name,
    cells: grid.cells,
    columnIndexes: grid.columnIndexes,
  });
}

/** Lê a aba como vários blocos independentes, do jeito que relatórios reais são montados. */
export function buildTablesFromSheet(table: RawTable, startIndex: number): ParsedTable[] {
  const sheet = prepareSheet(table);
  const blocks = splitIntoBlocks(sheet);

  return blocks.map((block, index) => {
    const grid = trimEmpty(block.cells, block.columnIndexes);
    return buildFromCells({
      key: `t${startIndex + index}`,
      label: block.context ?? table.name,
      sheetName: table.name,
      cells: grid.cells,
      columnIndexes: grid.columnIndexes,
    });
  });
}

/** Blocos diferentes sob a mesma faixa de título recebem um sufixo. */
function dedupeLabels(tables: ParsedTable[]): ParsedTable[] {
  const vistos = new Map<string, number>();
  return tables.map((table) => {
    const contagem = vistos.get(table.schema.label) ?? 0;
    vistos.set(table.schema.label, contagem + 1);
    if (contagem === 0) return table;
    return { ...table, schema: { ...table.schema, label: `${table.schema.label} (${contagem + 1})` } };
  });
}

export function buildParsedWorkbook(
  source: DataSourceDescriptor,
  tables: RawTable[],
): ParsedWorkbook {
  const parsed: ParsedTable[] = [];
  for (const table of tables) {
    for (const bloco of buildTablesFromSheet(table, parsed.length)) {
      // Blocos sem coluna aproveitável ou sem linha de dado só poluiriam a revisão.
      if (bloco.schema.columns.length === 0 || bloco.schema.rowCount === 0) continue;
      parsed.push(bloco);
    }
  }
  return { source, tables: dedupeLabels(parsed) };
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

/** Recalcula estatísticas e amostras depois de o usuário editar valores. */
export function refreshTableStats(table: ParsedTable): ParsedTable {
  const columns = table.schema.columns.map((column, index) => {
    const values = table.rows.map((row) => row[index]);
    return {
      ...column,
      stats: buildColumnStats(values, column.type),
      sampleValues: pickSamples(values, SAMPLE_SIZE),
    };
  });
  return { schema: { ...table.schema, columns, rowCount: table.rows.length }, rows: table.rows };
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
