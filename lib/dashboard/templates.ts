/**
 * Templates de layout e distribuição em folhas.
 *
 * Um template é uma lista ordenada de vagas em UMA folha. Como o dashboard
 * tem quantas folhas forem necessárias, aplicar um template **reposiciona**
 * os gráficos existentes e abre folhas novas conforme precisa — nunca apaga
 * nada (CLAUDE.md, 11.5).
 *
 * Vagas `small` são preenchidas primeiro pelos indicadores (KPI), que são
 * apenas um número e ficariam ridículos ocupando meia folha.
 */

import { GRID_COLS, GRID_GAP, GRID_ROWS, GRID_ROW_HEIGHT, PAGE_WIDTH } from "@/lib/dashboard/page";
import type { ChartLayout, ChartSpec, PlacedChart } from "@/lib/dashboard/types";

export interface TemplateSlot {
  kind: "small" | "large";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutTemplate {
  id: string;
  label: string;
  description: string;
  slots: TemplateSlot[];
}

const small = (x: number, y: number, w: number, h: number): TemplateSlot => ({
  x,
  y,
  w,
  h,
  kind: "small",
});
const large = (x: number, y: number, w: number, h: number): TemplateSlot => ({
  x,
  y,
  w,
  h,
  kind: "large",
});

export const TEMPLATES: readonly LayoutTemplate[] = [
  {
    id: "indicadores-no-topo",
    label: "Indicadores no topo",
    description: "Números em destaque na primeira linha e quatro gráficos abaixo.",
    slots: [
      small(0, 0, 3, 3),
      small(3, 0, 3, 3),
      small(6, 0, 3, 3),
      small(9, 0, 3, 3),
      large(0, 3, 6, 4),
      large(6, 3, 6, 4),
      large(0, 7, 6, 4),
      large(6, 7, 6, 4),
    ],
  },
  {
    id: "um-em-destaque",
    label: "Um gráfico em destaque",
    description: "Um gráfico grande à esquerda, apoiado por peças menores.",
    slots: [
      large(0, 0, 8, 7),
      small(8, 0, 4, 3),
      small(8, 3, 4, 4),
      large(0, 7, 4, 5),
      large(4, 7, 4, 5),
      large(8, 7, 4, 5),
    ],
  },
  {
    id: "grade",
    label: "Grade 2x2",
    description: "Quatro gráficos do mesmo tamanho.",
    slots: [large(0, 0, 6, 6), large(6, 0, 6, 6), large(0, 6, 6, 6), large(6, 6, 6, 6)],
  },
  {
    id: "coluna-unica",
    label: "Coluna única",
    description: "Gráficos largos, um embaixo do outro.",
    slots: [
      small(0, 0, 4, 3),
      small(4, 0, 4, 3),
      small(8, 0, 4, 3),
      large(0, 3, GRID_COLS, 4),
      large(0, 7, GRID_COLS, 4),
    ],
  },
] as const;

export const DEFAULT_TEMPLATE_ID = TEMPLATES[0].id;

export function getTemplate(id: string): LayoutTemplate {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0];
}

/** Quantas folhas o dashboard tem hoje. Sempre pelo menos uma. */
export function pageCount(charts: PlacedChart[]): number {
  return charts.reduce((total, chart) => Math.max(total, chart.layout.page + 1), 1);
}

export function chartsOnPage(charts: PlacedChart[], page: number): PlacedChart[] {
  return charts.filter((chart) => chart.layout.page === page);
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

/** Distribui gráficos nas vagas de UMA folha. O que não couber volta em `overflow`. */
function fillPage(
  template: LayoutTemplate,
  charts: ChartSpec[],
  page: number,
): { placed: PlacedChart[]; overflow: ChartSpec[] } {
  const livres = template.slots.map((slot) => ({ slot, tomada: false }));
  const placed: PlacedChart[] = [];
  const overflow: ChartSpec[] = [];

  const tomar = (preferida: TemplateSlot["kind"]) => {
    const escolhida =
      livres.find((vaga) => !vaga.tomada && vaga.slot.kind === preferida) ??
      livres.find((vaga) => !vaga.tomada);
    if (escolhida) escolhida.tomada = true;
    return escolhida;
  };

  for (const chart of charts) {
    const vaga = tomar(chart.type === "kpi" ? "small" : "large");
    if (!vaga) {
      overflow.push(chart);
      continue;
    }
    const { x, y, w, h } = vaga.slot;
    placed.push({ ...chart, layout: { page, x, y, w, h } });
  }

  // Preserva a leitura de cima para baixo, da esquerda para a direita.
  placed.sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
  return { placed, overflow };
}

/**
 * Reposiciona todos os gráficos nas vagas do template, abrindo folhas até
 * acabarem. Nenhum gráfico é descartado — é por isso que trocar de template
 * não precisa mais avisar nada antes.
 */
export function applyTemplate(template: LayoutTemplate, charts: ChartSpec[]): PlacedChart[] {
  const placed: PlacedChart[] = [];
  let restantes = charts;

  for (let page = 0; restantes.length > 0; page++) {
    const resultado = fillPage(template, restantes, page);
    // Template sem vagas: sair daqui em vez de abrir folhas para sempre.
    if (resultado.placed.length === 0) break;
    placed.push(...resultado.placed);
    restantes = resultado.overflow;
  }

  return placed;
}

/** Primeira vaga do template livre nesta folha, ou null se a folha está cheia. */
function freeSlotOnPage(
  charts: PlacedChart[],
  template: LayoutTemplate,
  kind: TemplateSlot["kind"],
): TemplateSlot | null {
  const candidatas = [
    ...template.slots.filter((slot) => slot.kind === kind),
    ...template.slots.filter((slot) => slot.kind !== kind),
  ];

  for (const slot of candidatas) {
    if (!charts.some((chart) => overlaps(chart.layout, slot))) return slot;
  }
  return null;
}

/**
 * Onde colocar um gráfico novo: a primeira vaga livre, folha a folha. Se todas
 * estiverem cheias, ele abre a folha seguinte — a folha não é mais um limite.
 */
export function findFreeSlot(
  charts: PlacedChart[],
  template: LayoutTemplate,
  kind: TemplateSlot["kind"],
): ChartLayout {
  const total = pageCount(charts);

  for (let page = 0; page < total; page++) {
    const vaga = freeSlotOnPage(chartsOnPage(charts, page), template, kind);
    if (vaga) return { page, x: vaga.x, y: vaga.y, w: vaga.w, h: vaga.h };
  }

  const nova = template.slots.find((slot) => slot.kind === kind) ?? template.slots[0];
  return { page: total, x: nova.x, y: 0, w: nova.w, h: nova.h };
}

/**
 * Procura, célula a célula, onde um gráfico de tamanho `w` x `h` cabe numa
 * folha já ocupada. Usado ao mover um gráfico de folha, quando o tamanho dele
 * não corresponde a nenhuma vaga do template.
 */
export function findSlotOnPage(
  ocupantes: PlacedChart[],
  w: number,
  h: number,
): { x: number; y: number } | null {
  for (let y = 0; y + h <= GRID_ROWS; y++) {
    for (let x = 0; x + w <= GRID_COLS; x++) {
      const candidata = { x, y, w, h };
      if (!ocupantes.some((chart) => overlaps(chart.layout, candidata))) return { x, y };
    }
  }
  return null;
}

/**
 * Renumera as folhas para que não sobre nenhuma vazia no meio. Uma folha só
 * existe enquanto tem gráfico: esvaziou, some — senão o PDF sairia com uma
 * página em branco que o usuário não pediu.
 */
export function normalizePages(charts: PlacedChart[]): PlacedChart[] {
  const usadas = [...new Set(charts.map((chart) => chart.layout.page))].sort((a, b) => a - b);
  const destino = new Map(usadas.map((page, indice) => [page, indice]));

  return charts.map((chart) => {
    const page = destino.get(chart.layout.page) ?? 0;
    return page === chart.layout.page ? chart : { ...chart, layout: { ...chart.layout, page } };
  });
}

/* ------------------------------------------------------------------ *
 * Preencher a folha
 *
 * Reposiciona os gráficos de cada folha para que ocupem a página inteira, sem
 * sobra embaixo nem buraco no meio. Diferente de um template, que é um desenho
 * fixo: aqui o desenho sai da quantidade de gráficos que a folha tem.
 * ------------------------------------------------------------------ */

/** Proporção de cartão que se lê bem: mais largo que alto, como a folha. */
const PROPORCAO_ALVO = 1.6;

/** Abaixo de quatro colunas o cartão não comporta eixo e rótulo. */
const MAX_POR_LINHA = 3;

/** Altura, em linhas da grade, da faixa reservada aos indicadores. */
const FAIXA_DE_INDICADORES = 3;

/**
 * Reparte `total` unidades entre `n` peças, dando o resto às primeiras.
 * A soma é exatamente `total` — é isso que garante o preenchimento sem sobra.
 */
function reparte(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const resto = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

/** Em quantas faixas dividir `n` gráficos, escolhendo pela proporção do cartão. */
function escolheLinhas(n: number, alturaEmLinhas: number): number {
  const maximo = Math.max(1, Math.min(4, n, Math.floor(alturaEmLinhas / 2)));
  const minimo = Math.min(maximo, Math.max(1, Math.ceil(n / MAX_POR_LINHA)));

  let melhor = minimo;
  let menorErro = Infinity;

  for (let linhas = minimo; linhas <= maximo; linhas++) {
    const porLinha = Math.ceil(n / linhas);
    const larguraPx = (PAGE_WIDTH - (porLinha - 1) * GRID_GAP) / porLinha;
    const linhasPorFaixa = alturaEmLinhas / linhas;
    const alturaPx = linhasPorFaixa * GRID_ROW_HEIGHT + (linhasPorFaixa - 1) * GRID_GAP;
    const erro = Math.abs(larguraPx / alturaPx - PROPORCAO_ALVO);
    if (erro < menorErro) {
      menorErro = erro;
      melhor = linhas;
    }
  }
  return melhor;
}

/** Ladrilha `itens` numa faixa que começa em `y0` e tem `altura` linhas. */
function ladrilha(
  itens: PlacedChart[],
  y0: number,
  altura: number,
  page: number,
): PlacedChart[] {
  if (itens.length === 0) return [];

  const linhas = escolheLinhas(itens.length, altura);
  const porLinha = reparte(itens.length, linhas);
  const alturas = reparte(altura, linhas);

  const postos: PlacedChart[] = [];
  let indice = 0;
  let y = y0;

  porLinha.forEach((quantos, faixa) => {
    const larguras = reparte(GRID_COLS, quantos);
    let x = 0;
    for (let i = 0; i < quantos; i++) {
      const chart = itens[indice++];
      postos.push({
        ...chart,
        layout: { page, x, y, w: larguras[i], h: alturas[faixa] },
      });
      x += larguras[i];
    }
    y += alturas[faixa];
  });

  return postos;
}

/**
 * Ocupa toda a folha, em todas as folhas.
 *
 * Os indicadores ganham uma faixa própria no topo, mais baixa: um número só
 * esticado em meia página é desperdício de folha, e é o mesmo motivo pelo qual
 * os templates têm vagas pequenas. Quando a folha só tem indicadores, eles
 * dividem a página inteira — não há o que reservar.
 */
export function fillSheets(charts: PlacedChart[]): PlacedChart[] {
  const total = pageCount(charts);
  const resultado: PlacedChart[] = [];

  for (let page = 0; page < total; page++) {
    const daFolha = chartsOnPage(charts, page).sort(
      (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x,
    );
    if (daFolha.length === 0) continue;

    const indicadores = daFolha.filter((chart) => chart.type === "kpi");
    const demais = daFolha.filter((chart) => chart.type !== "kpi");

    if (indicadores.length > 0 && demais.length > 0) {
      resultado.push(...ladrilha(indicadores, 0, FAIXA_DE_INDICADORES, page));
      resultado.push(
        ...ladrilha(demais, FAIXA_DE_INDICADORES, GRID_ROWS - FAIXA_DE_INDICADORES, page),
      );
    } else {
      resultado.push(...ladrilha(daFolha, 0, GRID_ROWS, page));
    }
  }

  return resultado;
}
