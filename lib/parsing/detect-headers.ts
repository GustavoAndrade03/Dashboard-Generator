/**
 * Detecção da linha de cabeçalho em planilhas desestruturadas.
 *
 * Planilhas reais raramente começam com o cabeçalho na primeira linha: há
 * títulos, logos, linhas de filtro e blocos de observação antes. Em vez de
 * assumir a linha 0, pontuamos as primeiras linhas e escolhemos a que mais
 * "parece" cabeçalho — principalmente por contrastar com o tipo dos dados
 * logo abaixo.
 */

import type { RawValue } from "@/lib/data-sources/types";
import { parseBooleanValue, parseDateValue, parseNumberValue } from "@/lib/parsing/infer-types";
import { columnLetter, isBlank } from "@/lib/parsing/normalize";

const MAX_HEADER_SEARCH_ROWS = 20;
const LOOKAHEAD_ROWS = 6;
/** Abaixo disso preferimos assumir que a planilha não tem cabeçalho. */
const MIN_HEADER_SCORE = 0.55;

type CellKind = "blank" | "text" | "number" | "date" | "boolean";

function cellKind(value: RawValue): CellKind {
  if (isBlank(value)) return "blank";
  if (parseBooleanValue(value) !== null) return "boolean";
  if (parseDateValue(value) !== null) return "date";
  if (parseNumberValue(value) !== null) return "number";
  return "text";
}

function cleanLabel(value: RawValue): string {
  if (isBlank(value)) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/**
 * Pontua uma linha candidata a cabeçalho. Combina quatro sinais: quão
 * preenchida ela está, quanto dela é texto, quão únicos são os valores e —
 * o sinal mais forte — quanto o perfil de tipos difere das linhas seguintes.
 */
function scoreRow(cells: RawValue[][], rowIndex: number): number {
  // Um cabeçalho sem nenhuma linha de dados abaixo não serve para nada, e
  // aceitá-lo faria a última linha de uma planilha puramente numérica ganhar
  // pontos de graça (não há linhas seguintes para contrastar com ela).
  if (rowIndex >= cells.length - 1) return 0;

  const row = cells[rowIndex];
  const width = row.length;
  if (width === 0) return 0;

  const kinds = row.map(cellKind);
  const nonBlank = kinds.filter((kind) => kind !== "blank").length;
  if (nonBlank === 0) return 0;

  const fill = nonBlank / width;
  if (fill < 0.5) return 0;

  const textRatio = kinds.filter((kind) => kind === "text").length / nonBlank;
  // Cabeçalho é rótulo: uma linha majoritariamente numérica é dado, não título.
  if (textRatio < 0.5) return 0;
  const labels = row.filter((value) => !isBlank(value)).map((value) => cleanLabel(value).toLowerCase());
  const uniqueRatio = new Set(labels).size / nonBlank;
  const shortRatio = labels.filter((label) => label.length <= 40).length / nonBlank;

  let diffTotal = 0;
  let comparedRows = 0;
  const lastRow = Math.min(cells.length, rowIndex + 1 + LOOKAHEAD_ROWS);
  for (let below = rowIndex + 1; below < lastRow; below++) {
    const belowKinds = cells[below].map(cellKind);
    let differences = 0;
    let considered = 0;
    for (let col = 0; col < width; col++) {
      if (kinds[col] === "blank" || belowKinds[col] === "blank") continue;
      considered++;
      if (kinds[col] !== belowKinds[col]) differences++;
    }
    if (considered > 0) {
      diffTotal += differences / considered;
      comparedRows++;
    }
  }
  // Sem linhas de dados abaixo não há contraste a medir: pontuação neutra.
  const belowDiff = comparedRows > 0 ? diffTotal / comparedRows : 0.5;

  return 0.28 * fill + 0.24 * textRatio + 0.16 * uniqueRatio + 0.26 * belowDiff + 0.06 * shortRatio;
}

/**
 * Cabeçalhos em dois níveis ("1o Trimestre" mesclado sobre "Jan/Fev/Mar")
 * viram uma linha de rótulos repetidos depois de `applyMerges`. Quando a
 * linha acima do cabeçalho tem essa cara, os dois níveis são concatenados.
 */
function isGroupTitleRow(cells: RawValue[][], rowIndex: number): boolean {
  if (rowIndex < 0) return false;
  const row = cells[rowIndex];
  const present = row.filter((value) => !isBlank(value));
  if (present.length === 0) return false;
  if (present.length / row.length < 0.6) return false;
  if (present.some((value) => cellKind(value) !== "text")) return false;
  return new Set(present.map((value) => cleanLabel(value))).size / present.length < 0.6;
}

function dedupeLabels(labels: string[]): string[] {
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const count = seen.get(label) ?? 0;
    seen.set(label, count + 1);
    return count === 0 ? label : `${label} (${count + 1})`;
  });
}

export interface HeaderDetection {
  /** Índice na grade normalizada, ou null quando nenhum cabeçalho convence. */
  rowIndex: number | null;
  confidence: number;
  labels: string[];
  /** Primeira linha de dados na grade normalizada. */
  dataStartRow: number;
}

export function detectHeader(cells: RawValue[][], columnIndexes: number[]): HeaderDetection {
  const width = columnIndexes.length;
  const fallbackLabels = columnIndexes.map((index) => `Coluna ${columnLetter(index)}`);

  if (cells.length === 0 || width === 0) {
    return { rowIndex: null, confidence: 0, labels: fallbackLabels, dataStartRow: 0 };
  }

  let bestRow = -1;
  let bestScore = 0;
  const searchLimit = Math.min(cells.length, MAX_HEADER_SEARCH_ROWS);
  for (let row = 0; row < searchLimit; row++) {
    const score = scoreRow(cells, row);
    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  }

  if (bestRow < 0 || bestScore < MIN_HEADER_SCORE) {
    return { rowIndex: null, confidence: bestScore, labels: fallbackLabels, dataStartRow: 0 };
  }

  const headerRow = cells[bestRow];
  const groupRow = isGroupTitleRow(cells, bestRow - 1) ? cells[bestRow - 1] : null;

  const labels = headerRow.map((value, column) => {
    const own = cleanLabel(value);
    const group = groupRow ? cleanLabel(groupRow[column]) : "";
    if (own && group && group !== own) return `${group} - ${own}`;
    if (own) return own;
    if (group) return group;
    return fallbackLabels[column];
  });

  return {
    rowIndex: bestRow,
    confidence: Math.min(1, bestScore),
    labels: dedupeLabels(labels),
    dataStartRow: bestRow + 1,
  };
}
