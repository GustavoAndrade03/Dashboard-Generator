import { describe, expect, it } from "vitest";

import { createChart, normalizeSpec } from "@/lib/dashboard/chart-spec";
import { GRID_AREA_HEIGHT, GRID_GAP, GRID_ROWS, GRID_ROW_HEIGHT } from "@/lib/dashboard/page";
import { PALETTES, colorAt, getPalette } from "@/lib/dashboard/palettes";
import { TEMPLATES, applyTemplate, findFreeSlot, getTemplate } from "@/lib/dashboard/templates";
import type { ChartSpec, PlacedChart } from "@/lib/dashboard/types";
import { buildParsedTable } from "@/lib/parsing/schema-builder";

const tabela = buildParsedTable(
  {
    name: "Vendas",
    cells: [
      ["Data", "Região", "Faturamento", "Qtd"],
      ["15/01/2024", "Sul", 100, 2],
      ["20/01/2024", "Norte", 200, 3],
      ["10/02/2024", "Sul", 300, 1],
      ["25/02/2024", "Leste", 150, 4],
    ],
    merges: [],
  },
  0,
);

const [dataKey, regiaoKey, valorKey, qtdKey] = tabela.schema.columns.map((column) => column.key);

function spec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    id: "c1",
    type: "bar",
    title: "Teste",
    tableKey: "t0",
    categoryKey: regiaoKey,
    valueKeys: [valorKey],
    aggregation: "sum",
    limit: 12,
    rationale: "",
    origin: "user",
    ...overrides,
  };
}

function placed(id: string, x: number, y: number, w: number, h: number): PlacedChart {
  return { ...spec({ id }), layout: { x, y, w, h } };
}

describe("geometria da folha", () => {
  it("a grade cheia cabe na área útil da página", () => {
    const altura = GRID_ROWS * GRID_ROW_HEIGHT + (GRID_ROWS - 1) * GRID_GAP;
    expect(altura).toBeLessThanOrEqual(GRID_AREA_HEIGHT);
  });

  it("nenhum template posiciona um gráfico além do teto de linhas", () => {
    for (const template of TEMPLATES) {
      for (const slot of template.slots) {
        expect(slot.y + slot.h).toBeLessThanOrEqual(GRID_ROWS);
        expect(slot.x + slot.w).toBeLessThanOrEqual(12);
      }
    }
  });

  it("as vagas de um template não se sobrepõem", () => {
    for (const template of TEMPLATES) {
      for (let a = 0; a < template.slots.length; a++) {
        for (let b = a + 1; b < template.slots.length; b++) {
          const um = template.slots[a];
          const outro = template.slots[b];
          const sobrepoe =
            um.x < outro.x + outro.w &&
            outro.x < um.x + um.w &&
            um.y < outro.y + outro.h &&
            outro.y < um.y + um.h;
          expect(sobrepoe, `${template.id}: vagas ${a} e ${b}`).toBe(false);
        }
      }
    }
  });
});

describe("applyTemplate", () => {
  const template = getTemplate("indicadores-no-topo");

  it("manda indicadores para as vagas pequenas", () => {
    const { placed: resultado } = applyTemplate(template, [
      spec({ id: "grafico", type: "bar" }),
      spec({ id: "numero", type: "kpi" }),
    ]);

    const numero = resultado.find((chart) => chart.id === "numero")!;
    const grafico = resultado.find((chart) => chart.id === "grafico")!;
    expect(numero.layout.w).toBeLessThan(grafico.layout.w);
    expect(numero.layout.y).toBe(0);
  });

  it("reposiciona sem apagar quando há vagas suficientes", () => {
    const entrada = Array.from({ length: 4 }, (_, i) => spec({ id: `c${i}` }));
    const { placed: resultado, overflow } = applyTemplate(template, entrada);
    expect(resultado).toHaveLength(4);
    expect(overflow).toHaveLength(0);
  });

  it("devolve o excedente quando o template é menor", () => {
    const entrada = Array.from({ length: 6 }, (_, i) => spec({ id: `c${i}` }));
    const { placed: resultado, overflow } = applyTemplate(getTemplate("grade"), entrada);
    expect(resultado).toHaveLength(4);
    expect(overflow.map((chart) => chart.id)).toEqual(["c4", "c5"]);
  });

  it("ordena de cima para baixo, da esquerda para a direita", () => {
    const entrada = Array.from({ length: 6 }, (_, i) => spec({ id: `c${i}` }));
    const { placed: resultado } = applyTemplate(template, entrada);
    for (let i = 1; i < resultado.length; i++) {
      const anterior = resultado[i - 1].layout;
      const atual = resultado[i].layout;
      expect(anterior.y < atual.y || (anterior.y === atual.y && anterior.x <= atual.x)).toBe(true);
    }
  });
});

describe("findFreeSlot", () => {
  const template = getTemplate("grade");

  it("acha a primeira vaga livre", () => {
    const ocupadas: PlacedChart[] = [placed("a", 0, 0, 6, 6)];
    expect(findFreeSlot(ocupadas, template, "large")).toEqual({ x: 6, y: 0, w: 6, h: 6 });
  });

  it("devolve null quando a folha está cheia", () => {
    const ocupadas = template.slots.map((slot, index) =>
      placed(`c${index}`, slot.x, slot.y, slot.w, slot.h),
    );
    expect(findFreeSlot(ocupadas, template, "large")).toBeNull();
  });
});

describe("normalizeSpec", () => {
  it("descarta colunas que não existem mais", () => {
    const resultado = normalizeSpec(spec({ valueKeys: [valorKey, "sumiu"] }), tabela);
    expect(resultado.valueKeys).toEqual([valorKey]);
  });

  it("reduz o indicador a um único valor e sem agrupamento", () => {
    const resultado = normalizeSpec(
      spec({ type: "kpi", valueKeys: [valorKey, qtdKey] }),
      tabela,
    );
    expect(resultado.valueKeys).toEqual([valorKey]);
    expect(resultado.categoryKey).toBeNull();
  });

  it("preenche o agrupamento quando o formato exige e nenhum foi escolhido", () => {
    const resultado = normalizeSpec(spec({ categoryKey: null }), tabela);
    expect(resultado.categoryKey).toBeTruthy();
  });

  it("recusa coluna numérica como agrupamento", () => {
    const resultado = normalizeSpec(spec({ categoryKey: valorKey }), tabela);
    expect(resultado.categoryKey).not.toBe(valorKey);
  });

  it("cai para contagem quando não sobra nenhuma coluna de valor", () => {
    const resultado = normalizeSpec(spec({ valueKeys: [] }), tabela);
    expect(resultado.aggregation).toBe("count");
  });

  it("agrupa por mês quando o eixo é uma data", () => {
    const resultado = normalizeSpec(spec({ categoryKey: dataKey }), tabela);
    expect(resultado.granularity).toBe("month");
  });

  it("não deixa granularidade sobrando quando o eixo não é data", () => {
    const resultado = normalizeSpec(spec({ categoryKey: regiaoKey, granularity: "month" }), tabela);
    expect(resultado.granularity).toBeUndefined();
  });
});

describe("createChart", () => {
  it("já nasce com colunas plausíveis preenchidas", () => {
    const novo = createChart(tabela, "novo");
    expect(novo.tableKey).toBe("t0");
    expect(novo.categoryKey).toBeTruthy();
    expect(novo.valueKeys.length).toBeGreaterThan(0);
    expect(novo.origin).toBe("user");
  });
});

describe("paletas", () => {
  it("todas oferecem as mesmas oito matizes", () => {
    const referencia = [...PALETTES[0].colors].sort();
    for (const palette of PALETTES) {
      expect([...palette.colors].sort()).toEqual(referencia);
    }
  });

  it("cai na primeira paleta quando o id é desconhecido", () => {
    expect(getPalette("inexistente" as never).id).toBe(PALETTES[0].id);
  });

  it("atribui cores em ordem fixa e cicla só depois de esgotar", () => {
    const palette = PALETTES[0];
    expect(colorAt(palette, 0)).toBe(palette.colors[0]);
    expect(colorAt(palette, palette.colors.length)).toBe(palette.colors[0]);
  });
});
