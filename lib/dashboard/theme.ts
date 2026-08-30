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

/*
 * A tinta da folha mora em `themes.ts`, porque o usuário escolhe o tema — do
 * mesmo jeito que as cores de série moram em `palettes.ts`. Aqui ficam só as
 * funções que não dependem de escolha nenhuma.
 */

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

const percentFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Participação no conjunto mostrado, já com o sinal de porcentagem. */
export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}

/**
 * Tinta legível sobre uma cor de série — usada no rótulo dentro da barra
 * empilhada, onde não há superfície clara atrás do texto.
 *
 * Nenhuma das duas tintas passa em todas as oito matizes da paleta: o branco
 * reprova no amarelo e no laranja, o grafite reprova no violeta. A escolha é
 * por medida de contraste, matiz a matiz, em vez de uma cor fixa que erraria
 * em metade da paleta.
 */
export function labelInkOn(background: string, tintaEscura = "#0b0b0b"): string {
  const canal = [1, 3, 5]
    .map((i) => parseInt(background.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  const luminancia = 0.2126 * canal[0] + 0.7152 * canal[1] + 0.0722 * canal[2];

  const contraste = (outra: number) => {
    const [claro, escuro] = [luminancia, outra].sort((a, b) => b - a);
    return (claro + 0.05) / (escuro + 0.05);
  };

  // Luminância do osso (#ffffff) e do grafite (#0b0b0b).
  return contraste(1) >= contraste(0.00304) ? "#ffffff" : tintaEscura;
}
