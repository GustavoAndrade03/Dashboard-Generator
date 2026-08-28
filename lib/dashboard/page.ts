/**
 * Geometria da folha.
 *
 * Estes números são a razão de o WYSIWYG funcionar. A área de edição tem
 * exatamente as dimensões da área útil de um A4 paisagem com as margens de
 * 12mm declaradas no `@page` (globals.css), então o que o usuário arrasta na
 * tela ocupa o mesmo espaço no PDF — sem segunda implementação de layout
 * (CLAUDE.md, 11.1).
 *
 * Mexeu aqui? Mexa também na margem do `@page`, ou tela e papel divergem.
 */

/** 96dpi: 1mm = 3.7795px. */
const PX_PER_MM = 96 / 25.4;

const A4_LONG_MM = 297;
const A4_SHORT_MM = 210;
const PAGE_MARGIN_MM = 12;

/** 273mm — largura útil do A4 paisagem. */
export const PAGE_WIDTH = Math.round((A4_LONG_MM - 2 * PAGE_MARGIN_MM) * PX_PER_MM);

/** 186mm — altura útil do A4 paisagem. */
export const PAGE_HEIGHT = Math.round((A4_SHORT_MM - 2 * PAGE_MARGIN_MM) * PX_PER_MM);

/** Faixa do título do dashboard, no topo da folha. */
export const PAGE_HEADER_HEIGHT = 56;

/** Altura restante para a grade depois do título. */
export const GRID_AREA_HEIGHT = PAGE_HEIGHT - PAGE_HEADER_HEIGHT;

export const GRID_COLS = 12;
export const GRID_GAP = 16;

/**
 * Teto de linhas da grade. É o que impede o usuário de montar um dashboard que
 * não cabe na folha: acima disso o react-grid-layout recusa a posição.
 */
export const GRID_ROWS = 12;

/**
 * Altura da linha calculada para que a grade cheia caiba na área disponível:
 * GRID_ROWS linhas + (GRID_ROWS - 1) intervalos <= GRID_AREA_HEIGHT.
 */
export const GRID_ROW_HEIGHT = Math.floor(
  (GRID_AREA_HEIGHT - (GRID_ROWS - 1) * GRID_GAP) / GRID_ROWS,
);
