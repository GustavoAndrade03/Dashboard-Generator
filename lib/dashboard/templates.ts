/**
 * Templates de layout.
 *
 * Um template é uma lista ordenada de vagas na grade. Aplicar um template
 * **reposiciona** os gráficos existentes, nunca os apaga — se as vagas não
 * bastarem, quem chama avisa o usuário antes (CLAUDE.md, 11.5).
 *
 * Vagas `small` são preenchidas primeiro pelos indicadores (KPI), que são
 * apenas um número e ficariam ridículos ocupando meia folha.
 */

import { GRID_COLS } from "@/lib/dashboard/page";
import type { ChartLayout, ChartSpec, PlacedChart } from "@/lib/dashboard/types";

export interface TemplateSlot extends ChartLayout {
  kind: "small" | "large";
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

export function templateCapacity(template: LayoutTemplate): number {
  return template.slots.length;
}

/**
 * Distribui os gráficos nas vagas do template, na ordem em que aparecem.
 * Indicadores puxam as vagas pequenas; o resto puxa as grandes. O que não
 * couber é devolvido em `overflow` para quem chama decidir o que fazer.
 */
export function applyTemplate(
  template: LayoutTemplate,
  charts: ChartSpec[],
): { placed: PlacedChart[]; overflow: ChartSpec[] } {
  const livres = template.slots.map((slot, index) => ({ slot, index, tomada: false }));
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
    placed.push({ ...chart, layout: { x, y, w, h } });
  }

  // Preserva a leitura de cima para baixo, da esquerda para a direita.
  placed.sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
  return { placed, overflow };
}

/**
 * Encontra uma vaga livre para um gráfico novo, sem mexer nos que já estão na
 * folha. Devolve null quando não há espaço — a folha é uma página só.
 */
export function findFreeSlot(
  charts: PlacedChart[],
  template: LayoutTemplate,
  kind: TemplateSlot["kind"],
): ChartLayout | null {
  const ocupado = (slot: TemplateSlot) =>
    charts.some(
      (chart) =>
        chart.layout.x < slot.x + slot.w &&
        slot.x < chart.layout.x + chart.layout.w &&
        chart.layout.y < slot.y + slot.h &&
        slot.y < chart.layout.y + chart.layout.h,
    );

  const candidatas = [
    ...template.slots.filter((slot) => slot.kind === kind),
    ...template.slots.filter((slot) => slot.kind !== kind),
  ];

  for (const slot of candidatas) {
    if (!ocupado(slot)) return { x: slot.x, y: slot.y, w: slot.w, h: slot.h };
  }
  return null;
}
