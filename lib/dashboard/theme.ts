/**
 * Tokens visuais e formatação de números.
 *
 * As cores de série NÃO moram aqui — estão em `palettes.ts`, porque o usuário
 * escolhe entre várias. Aqui ficam a tinta e as linhas, que são fixas.
 *
 * Tema único (claro), sem variante escura: o PDF é a própria página impressa,
 * e um tema que muda com a preferência do sistema faria o arquivo divergir do
 * que está na tela (CLAUDE.md, 7.3).
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
