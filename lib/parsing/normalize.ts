/**
 * Limpeza da grade bruta, antes de qualquer inferência.
 *
 * Resolve células mescladas e descarta linhas/colunas totalmente vazias,
 * preservando os índices originais para que a UI de correção consiga apontar
 * o usuário de volta à posição real na planilha.
 */

import type { MergeRange, RawTable, RawValue } from "@/lib/data-sources/types";

export function isBlank(value: RawValue | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/** Converte 0 -> "A", 25 -> "Z", 26 -> "AA" (notação de coluna de planilha). */
export function columnLetter(index: number): string {
  let rest = index;
  let letter = "";
  do {
    letter = String.fromCharCode(65 + (rest % 26)) + letter;
    rest = Math.floor(rest / 26) - 1;
  } while (rest >= 0);
  return letter;
}

/** Garante que todas as linhas tenham a mesma largura. */
export function padGrid(cells: RawValue[][]): RawValue[][] {
  const width = cells.reduce((max, row) => Math.max(max, row.length), 0);
  return cells.map((row) => {
    const padded = row.slice();
    while (padded.length < width) padded.push(null);
    return padded;
  });
}

/**
 * Replica o valor da célula-mestra por toda a região mesclada.
 *
 * É o que torna cabeçalhos como "1o Trimestre" (mesclado sobre 3 colunas)
 * utilizáveis pela detecção de cabeçalho.
 */
export function applyMerges(cells: RawValue[][], merges: MergeRange[]): RawValue[][] {
  const grid = cells.map((row) => row.slice());
  for (const merge of merges) {
    const master = grid[merge.top]?.[merge.left] ?? null;
    if (isBlank(master)) continue;
    for (let row = merge.top; row <= merge.bottom; row++) {
      if (grid[row] === undefined) continue;
      for (let col = merge.left; col <= merge.right; col++) {
        if (isBlank(grid[row][col])) grid[row][col] = master;
      }
    }
  }
  return grid;
}

/**
 * Remove linhas e colunas totalmente vazias, preservando o índice original de
 * cada coluna mantida. É a etapa aplicada dentro de cada bloco, depois que a
 * aba já foi cortada.
 */
export function trimEmpty(cells: RawValue[][], columnIndexes: number[]): NormalizedGrid {
  const rowIndexes: number[] = [];
  cells.forEach((row, index) => {
    if (row.some((cell) => !isBlank(cell))) rowIndexes.push(index);
  });

  const mantidas: number[] = [];
  const origem: number[] = [];
  for (let col = 0; col < columnIndexes.length; col++) {
    if (rowIndexes.some((row) => !isBlank(cells[row][col]))) {
      mantidas.push(col);
      origem.push(columnIndexes[col]);
    }
  }

  return {
    cells: rowIndexes.map((row) => mantidas.map((col) => cells[row][col] ?? null)),
    columnIndexes: origem,
    rowIndexes,
  };
}

export interface NormalizedGrid {
  cells: RawValue[][];
  /** Índice original de cada coluna mantida (0-based na planilha). */
  columnIndexes: number[];
  /** Índice original de cada linha mantida. */
  rowIndexes: number[];
}

/**
 * Aplica mesclagens, uniformiza a largura e remove linhas/colunas 100% vazias.
 *
 * Linhas vazias no meio da planilha também são removidas: são quase sempre
 * separadores visuais. O caso de duas tabelas independentes na mesma aba
 * separadas por linhas em branco não é tratado no MVP.
 */
export function normalizeGrid(table: RawTable): NormalizedGrid {
  const padded = padGrid(table.cells);
  const merged = applyMerges(padded, table.merges);
  const width = merged[0]?.length ?? 0;

  const rowIndexes: number[] = [];
  merged.forEach((row, index) => {
    if (row.some((cell) => !isBlank(cell))) rowIndexes.push(index);
  });

  const columnIndexes: number[] = [];
  for (let col = 0; col < width; col++) {
    const hasContent = rowIndexes.some((rowIndex) => !isBlank(merged[rowIndex][col]));
    if (hasContent) columnIndexes.push(col);
  }

  const cells = rowIndexes.map((rowIndex) =>
    columnIndexes.map((colIndex) => merged[rowIndex][colIndex] ?? null),
  );

  return { cells, columnIndexes, rowIndexes };
}
