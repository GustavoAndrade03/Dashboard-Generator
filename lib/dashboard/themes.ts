/**
 * Temas da folha.
 *
 * Um tema troca o papel e a tinta do **documento** — não a bancada em volta,
 * que é moldura de edição e nunca chega ao papel.
 *
 * Isto não reabre a decisão da seção 10 ("tema claro único"): aquela regra
 * proíbe a folha seguir a preferência do sistema, porque o arquivo divergiria
 * do que está na tela. Aqui o tema é uma escolha explícita, guardada no
 * `DashboardConfig` junto com paleta e template — logo é o mesmo na tela, no
 * PDF e em quem reabrir o dashboard depois.
 *
 * **Todos os temas são claros, e isso é uma restrição de papel, não de gosto.**
 * Duas medidas, ambas feitas e não estimadas:
 *
 * 1. As oito matizes de série foram validadas contra cada superfície abaixo
 *    (banda de luminosidade, piso de croma, separação em daltonismo e piso de
 *    visão normal). Sobre um papel escuro, quatro delas saem da banda e o
 *    violeta cai para 1,89:1 — um tema escuro exige um jogo de matizes
 *    próprio, não estas.
 * 2. O Chrome não pinta a margem da página. Medido no PDF: o fundo cobre
 *    774x527pt, que é a caixa de conteúdo, enquanto a folha inteira tem
 *    842x595pt. Um papel muito distante do branco sairia como um retângulo
 *    colorido dentro de uma moldura branca de 12mm.
 *
 * Ao acrescentar um tema, rode o validador de paleta contra a nova superfície
 * antes de commitar — não confie no olho.
 */

export type SheetThemeId = "papel" | "branco" | "creme" | "nevoa";

export interface SheetInk {
  /** Título e número em destaque. */
  primary: string;
  /** Rótulo de valor, legenda, texto de tabela. */
  secondary: string;
  /** Marcação de eixo — o registro mais discreto que ainda se lê. */
  muted: string;
  /** Linha de grade do gráfico e borda de cartão. */
  gridline: string;
  /** Linha de base do eixo. */
  baseline: string;
}

export interface SheetTheme {
  id: SheetThemeId;
  label: string;
  /** Para que serve, em uma linha — vira o title do botão. */
  hint: string;
  /** Fundo da folha. */
  paper: string;
  /** Fundo do cartão de gráfico, um degrau adiante do papel. */
  surface: string;
  ink: SheetInk;
}

export const SHEET_THEMES: readonly SheetTheme[] = [
  {
    id: "papel",
    label: "Papel",
    hint: "Osso neutro. O padrão, e o que gasta menos tinta ao imprimir",
    paper: "#ffffff",
    surface: "#fcfcfb",
    ink: {
      primary: "#0b0b0b",
      secondary: "#52514e",
      muted: "#898781",
      gridline: "#e1e0d9",
      baseline: "#c3c2b7",
    },
  },
  {
    id: "branco",
    label: "Branco",
    hint: "Contraste máximo, para fotocópia, projeção e leitura com baixa visão",
    paper: "#ffffff",
    surface: "#ffffff",
    ink: {
      primary: "#000000",
      secondary: "#3f3f3f",
      muted: "#6b6b6b",
      gridline: "#d4d4d4",
      baseline: "#b0b0b0",
    },
  },
  {
    id: "creme",
    label: "Creme",
    hint: "Papel quente, de documento impresso — mais suave numa leitura longa",
    paper: "#fdfaf3",
    surface: "#faf6ee",
    ink: {
      primary: "#221e18",
      secondary: "#57503f",
      muted: "#8d8471",
      gridline: "#e5ddcd",
      baseline: "#cfc4ae",
    },
  },
  {
    id: "nevoa",
    label: "Névoa",
    hint: "Cinza frio, de relatório institucional",
    paper: "#f7f9fc",
    surface: "#f1f4f8",
    ink: {
      primary: "#14181d",
      secondary: "#4a525d",
      muted: "#7d8794",
      gridline: "#dbe1e9",
      baseline: "#c2cbd6",
    },
  },
] as const;

export const DEFAULT_SHEET_THEME_ID: SheetThemeId = "papel";

export function getSheetTheme(id: string | undefined): SheetTheme {
  return SHEET_THEMES.find((theme) => theme.id === id) ?? SHEET_THEMES[0];
}

/**
 * Variáveis que a folha declara para si e para tudo dentro dela.
 *
 * É por aqui que o tema chega às classes utilitárias sem nenhuma delas saber
 * que temas existem: `bg-surface`, `text-ink` e `border-gridline` já resolvem
 * para estas mesmas variáveis.
 */
export function sheetVars(theme: SheetTheme): React.CSSProperties {
  return {
    "--paper": theme.paper,
    "--surface": theme.surface,
    "--ink-primary": theme.ink.primary,
    "--ink-secondary": theme.ink.secondary,
    "--ink-muted": theme.ink.muted,
    "--gridline": theme.ink.gridline,
    "--baseline": theme.ink.baseline,
  } as React.CSSProperties;
}
