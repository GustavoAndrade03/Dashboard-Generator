/**
 * Divisão de uma aba em blocos independentes.
 *
 * Relatórios reais raramente têm uma tabela por aba. O formato típico empilha
 * vários quadros numa folha só, separados por linhas em branco e por faixas de
 * título mescladas de ponta a ponta ("4. GRUPOS ESPECIAIS"), com as unidades
 * no cabeçalho e o indicador na coluna da esquerda.
 *
 * Este módulo faz três coisas, nesta ordem:
 *  1. resolve as mesclagens e **descarta o que elas duplicam** — uma mesclagem
 *     vertical vira linha repetida, uma horizontal vira coluna repetida;
 *  2. reconhece as faixas de título e as usa como contexto do bloco seguinte;
 *  3. corta a aba em blocos nas linhas em branco e nas faixas de título.
 */

import type { MergeRange, RawTable, RawValue } from "@/lib/data-sources/types";
import { parseNumberValue } from "@/lib/parsing/infer-types";
import { applyMerges, isBlank, padGrid } from "@/lib/parsing/normalize";

/** Fração da largura que uma faixa precisa cobrir para ser título, e não dado. */
const BANNER_COVERAGE = 0.6;

/** Um título curto demais provavelmente é um rótulo, não uma faixa de seção. */
const MIN_BANNER_LENGTH = 3;

export interface PreparedSheet {
  cells: RawValue[][];
  /** Índice original de cada linha mantida. */
  rowIndexes: number[];
  /** Índice original de cada coluna mantida. */
  columnIndexes: number[];
  /** Célula a célula: a coluna aqui só repete o que a mesclagem trouxe da esquerda. */
  columnContinuation: boolean[][];
}

/**
 * Uma célula é "continuação" quando pertence a uma mesclagem que começou antes
 * dela. Linhas e colunas feitas só de continuações são cópias do que já foi
 * lido — é assim que um `I:J` mesclado vira duas colunas TOTAL idênticas.
 */
function continuationMaps(merges: MergeRange[], height: number, width: number) {
  const linhaContinua = Array.from({ length: height }, () => new Array<boolean>(width).fill(false));
  const colunaContinua = Array.from({ length: height }, () => new Array<boolean>(width).fill(false));

  for (const merge of merges) {
    for (let row = merge.top; row <= merge.bottom && row < height; row++) {
      for (let col = merge.left; col <= merge.right && col < width; col++) {
        if (row > merge.top) linhaContinua[row][col] = true;
        if (col > merge.left) colunaContinua[row][col] = true;
      }
    }
  }
  return { linhaContinua, colunaContinua };
}

/** Aplica as mesclagens e remove as linhas/colunas que elas apenas repetem. */
export function prepareSheet(table: RawTable): PreparedSheet {
  const padded = padGrid(table.cells);
  const merged = applyMerges(padded, table.merges);
  const height = merged.length;
  const width = merged[0]?.length ?? 0;
  const { linhaContinua, colunaContinua } = continuationMaps(table.merges, height, width);

  const rowIndexes: number[] = [];
  for (let row = 0; row < height; row++) {
    const preenchidas = merged[row]
      .map((valor, col) => ({ valor, col }))
      .filter((celula) => !isBlank(celula.valor));
    const soContinuacao =
      preenchidas.length > 0 && preenchidas.every((celula) => linhaContinua[row][celula.col]);
    if (!soContinuacao) rowIndexes.push(row);
  }

  const columnIndexes: number[] = [];
  for (let col = 0; col < width; col++) {
    const preenchidas = rowIndexes.filter((row) => !isBlank(merged[row][col]));
    // Colunas vazias na aba inteira saem aqui, e não só dentro de cada bloco:
    // é a largura útil que define se uma linha preenchida ponta a ponta é uma
    // faixa de título. Medindo contra colunas vazias, nenhuma faixa passaria.
    if (preenchidas.length === 0) continue;
    const soContinuacao = preenchidas.every((row) => colunaContinua[row][col]);
    if (!soContinuacao) columnIndexes.push(col);
  }

  return {
    cells: rowIndexes.map((row) => columnIndexes.map((col) => merged[row][col] ?? null)),
    rowIndexes,
    columnIndexes,
    columnContinuation: rowIndexes.map((row) => columnIndexes.map((col) => colunaContinua[row][col])),
  };
}

/**
 * Devolve o texto quando a linha é uma faixa de título: o mesmo texto repetido
 * por quase toda a largura, resultado de uma mesclagem de ponta a ponta.
 * Números repetidos não contam — uma linha de zeros é dado, não título.
 */
export function bannerText(row: RawValue[]): string | null {
  const preenchidas = row.filter((valor) => !isBlank(valor));
  if (preenchidas.length < 2) return null;
  if (preenchidas.length / row.length < BANNER_COVERAGE) return null;

  const primeiro = String(preenchidas[0]).trim();
  if (primeiro.length < MIN_BANNER_LENGTH) return null;
  if (parseNumberValue(primeiro) !== null) return null;
  if (!preenchidas.every((valor) => String(valor).trim() === primeiro)) return null;

  return primeiro;
}

export interface SheetBlock {
  /** Faixa de título mais recente acima do bloco. */
  context: string | null;
  cells: RawValue[][];
  /** Índice original das linhas do bloco, para o usuário se localizar. */
  rowIndexes: number[];
  /** Índice original de cada coluna da aba preparada. */
  columnIndexes: number[];
}

/**
 * Corta a aba em blocos. Linhas em branco e faixas de título encerram o bloco
 * corrente; a faixa mais recente vira o contexto do próximo.
 */
export function splitIntoBlocks(sheet: PreparedSheet, minRows = 2): SheetBlock[] {
  const blocks: SheetBlock[] = [];
  let contexto: string | null = null;
  let atual: number[] = [];

  const fechar = () => {
    if (atual.length >= minRows) {
      // A mesclagem I:J existe em alguns quadros e não em outros da mesma aba,
      // então a duplicata só pode ser identificada dentro do bloco: fora dele,
      // a mesma coluna carrega dado próprio.
      const mantidas: number[] = [];
      for (let col = 0; col < sheet.columnIndexes.length; col++) {
        const preenchidas = atual.filter((row) => !isBlank(sheet.cells[row][col]));
        if (preenchidas.length === 0) continue;
        if (preenchidas.every((row) => sheet.columnContinuation[row][col])) continue;
        mantidas.push(col);
      }

      blocks.push({
        context: contexto,
        cells: atual.map((row) => mantidas.map((col) => sheet.cells[row][col])),
        rowIndexes: atual.map((row) => sheet.rowIndexes[row]),
        columnIndexes: mantidas.map((col) => sheet.columnIndexes[col]),
      });
    }
    atual = [];
  };

  sheet.cells.forEach((row, index) => {
    if (row.every((valor) => isBlank(valor))) {
      fechar();
      return;
    }
    const faixa = bannerText(row);
    if (faixa !== null) {
      fechar();
      contexto = faixa;
      return;
    }
    atual.push(index);
  });

  fechar();
  return blocks;
}
