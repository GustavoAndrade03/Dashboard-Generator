/**
 * Tipos da Camada 1 (heurística determinística).
 *
 * O `TableSchema` produzido aqui é o único insumo da Camada 2 (IA) — ver
 * CLAUDE.md, seção 4.2. Todos os valores são serializáveis em JSON: datas
 * viram string ISO para poderem trafegar por API routes e coluna Json do
 * Postgres sem conversão extra.
 */

import type { DataSourceDescriptor } from "@/lib/data-sources/types";

export type CellValue = string | number | boolean | null;

export type ColumnType =
  | "date"
  | "number"
  | "category"
  | "identifier"
  | "boolean"
  | "empty";

export interface ColumnStats {
  totalCount: number;
  nonEmptyCount: number;
  distinctCount: number;
  numericMin?: number;
  numericMax?: number;
  numericMean?: number;
  /** Datas em ISO (YYYY-MM-DD). */
  dateMin?: string;
  dateMax?: string;
}

export interface ColumnSchema {
  /** Chave estável usada para referenciar a coluna em specs de gráfico. */
  key: string;
  /** Rótulo exibido ao usuário (cabeçalho detectado ou gerado). */
  label: string;
  /** Posição na grade bruta, para o usuário conseguir localizar na planilha. */
  sourceIndex: number;
  type: ColumnType;
  /** 0..1 — quão segura foi a inferência de tipo. Alimenta a UI de correção. */
  confidence: number;
  stats: ColumnStats;
  /** Amostra curta de valores, usada na revisão e no prompt da Camada 2. */
  sampleValues: string[];
}

export interface TableSchema {
  key: string;
  /** Nome da aba na planilha original. */
  label: string;
  /** Índice da linha de cabeçalho na grade normalizada, ou null se não houver. */
  headerRowIndex: number | null;
  headerConfidence: number;
  rowCount: number;
  columns: ColumnSchema[];
  /** Avisos legíveis para o usuário (ex: "cabeçalho não encontrado"). */
  warnings: string[];
}

/** Schema + dados já normalizados. As linhas seguem a ordem de `schema.columns`. */
export interface ParsedTable {
  schema: TableSchema;
  rows: CellValue[][];
}

export interface ParsedWorkbook {
  source: DataSourceDescriptor;
  tables: ParsedTable[];
}
