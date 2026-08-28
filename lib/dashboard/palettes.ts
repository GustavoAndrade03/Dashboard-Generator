/**
 * Paletas oferecidas ao usuário.
 *
 * Não há color picker livre de propósito (CLAUDE.md, 11.6): usuário leigo com
 * liberdade total de cor produz dashboards ilegíveis.
 *
 * Todas as paletas usam **as mesmas oito matizes** — o que muda entre elas é a
 * ordem dos slots. Isso não é economia de esforço: a ordem é o mecanismo que
 * garante separação em daltonismo entre séries vizinhas, e ordenações
 * inventadas à mão reprovam na validação. Cada ordem abaixo foi verificada
 * (banda de luminosidade, piso de croma, separação CVD e piso de visão normal
 * sobre a superfície clara).
 *
 * Ao acrescentar uma paleta, valide a ordem candidata antes de commitar — não
 * confie no olho.
 */

export type PaletteId = "azul" | "verde" | "violeta" | "laranja";

export interface Palette {
  id: PaletteId;
  /** Rótulo para o usuário: a cor que ele vai ver primeiro. */
  label: string;
  colors: readonly string[];
}

export const PALETTES: readonly Palette[] = [
  {
    id: "azul",
    label: "Azul",
    colors: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  },
  {
    id: "verde",
    label: "Verde",
    colors: ["#1baf7a", "#eb6834", "#4a3aa7", "#eda100", "#e87ba4", "#2a78d6", "#008300", "#e34948"],
  },
  {
    id: "violeta",
    label: "Violeta",
    colors: ["#4a3aa7", "#eb6834", "#1baf7a", "#2a78d6", "#e87ba4", "#eda100", "#008300", "#e34948"],
  },
  {
    id: "laranja",
    label: "Laranja",
    colors: ["#eb6834", "#1baf7a", "#008300", "#e34948", "#4a3aa7", "#e87ba4", "#2a78d6", "#eda100"],
  },
] as const;

export const DEFAULT_PALETTE_ID: PaletteId = "azul";

export function getPalette(id: PaletteId): Palette {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

/** Cores são atribuídas em ordem fixa, nunca cicladas por rank de valor. */
export function colorAt(palette: Palette, index: number): string {
  return palette.colors[index % palette.colors.length];
}
