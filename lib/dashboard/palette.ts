/**
 * Tokens visuais do dashboard.
 *
 * Tema único (claro), sem variante escura: a exportação em PDF renderiza a
 * própria página no Chromium, e um tema que muda com a preferência do sistema
 * faria o PDF divergir do que o usuário viu na tela (CLAUDE.md, seção 7.3).
 *
 * As cores de série são atribuídas em ordem fixa — nunca cicladas nem
 * geradas — e foram validadas para separação em daltonismo sobre a superfície
 * clara abaixo.
 */

export const SURFACE = "#fcfcfb";
export const PAGE_PLANE = "#f9f9f7";

export const INK = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  gridline: "#e1e0d9",
  baseline: "#c3c2b7",
} as const;

/** Ordem fixa dos slots categóricos. A 9ª série vira "Outros", não uma cor nova. */
export const SERIES_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
] as const;

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const compactFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return numberFormatter.format(value);
}

/** Usado nos ticks de eixo, onde espaço é escasso. */
export function formatCompact(value: number): string {
  return compactFormatter.format(value);
}
