/**
 * Geometria da folha.
 *
 * Estes números são a razão de o WYSIWYG funcionar. Uma folha tem exatamente
 * as dimensões da área útil de um A4 paisagem com as margens de 12mm
 * declaradas no `@page` (globals.css), então o que o usuário arrasta na tela
 * ocupa o mesmo espaço no PDF — sem segunda implementação de layout
 * (CLAUDE.md, 11.1).
 *
 * O dashboard tem quantas folhas forem necessárias. Cada folha é um bloco de
 * altura fixa no fluxo normal, e a quebra de página cai entre elas — por isso
 * nenhum gráfico é cortado ao meio no PDF.
 *
 * Mexeu aqui? Mexa também na margem do `@page`, ou tela e papel divergem.
 */

/** 96dpi: 1mm = 3.7795px. */
const PX_PER_MM = 96 / 25.4;

const A4_LONG_MM = 297;
const A4_SHORT_MM = 210;
const PAGE_MARGIN_MM = 12;

/**
 * Área útil do A4 paisagem: 273mm x 186mm.
 *
 * Arredondar para baixo, e não para o mais próximo, é deliberado: um único
 * pixel a mais que a caixa da página faz o Chrome abrir uma folha em branco
 * depois de cada folha cheia.
 */
export const PAGE_WIDTH = Math.floor((A4_LONG_MM - 2 * PAGE_MARGIN_MM) * PX_PER_MM);

export const PAGE_HEIGHT = Math.floor((A4_SHORT_MM - 2 * PAGE_MARGIN_MM) * PX_PER_MM);

/** Faixa do título, no topo de cada folha. */
export const PAGE_HEADER_HEIGHT = 56;

/** Altura restante para a grade depois do título. */
export const GRID_AREA_HEIGHT = PAGE_HEIGHT - PAGE_HEADER_HEIGHT;

export const GRID_COLS = 12;
export const GRID_GAP = 16;

/**
 * Teto de linhas de uma folha. É o que impede um gráfico de atravessar a
 * quebra de página: acima disso o react-grid-layout recusa a posição, e o
 * gráfico vai para a folha seguinte.
 */
export const GRID_ROWS = 12;

/**
 * Altura da linha calculada para que a grade cheia caiba na área disponível:
 * GRID_ROWS linhas + (GRID_ROWS - 1) intervalos <= GRID_AREA_HEIGHT.
 */
export const GRID_ROW_HEIGHT = Math.floor(
  (GRID_AREA_HEIGHT - (GRID_ROWS - 1) * GRID_GAP) / GRID_ROWS,
);

/** Largura de uma coluna da grade, em pixels. */
export const GRID_COL_WIDTH = (PAGE_WIDTH - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS;

/**
 * Tamanho em pixels de um cartão que ocupa `w` x `h` da grade.
 *
 * Sai da geometria, e não de uma medição no navegador: o gráfico precisa
 * decidir como desenhar o eixo antes de existir na tela, e uma medição daria
 * respostas diferentes na tela e no papel — que é exatamente o que o WYSIWYG
 * não pode ter.
 */
export function cardSize(w: number, h: number): { width: number; height: number } {
  return {
    width: w * GRID_COL_WIDTH + (w - 1) * GRID_GAP,
    height: h * GRID_ROW_HEIGHT + (h - 1) * GRID_GAP,
  };
}

/** Altura ocupada pela grade cheia. */
export const GRID_HEIGHT = GRID_ROWS * GRID_ROW_HEIGHT + (GRID_ROWS - 1) * GRID_GAP;

/**
 * Altura desenhada da folha: o título mais a grade cheia, e não a área útil
 * inteira do papel. A sobra de poucos pixels é a folga que garante que a folha
 * seguinte comece numa página nova, em vez de numa página em branco.
 */
export const SHEET_HEIGHT = PAGE_HEADER_HEIGHT + GRID_HEIGHT;
