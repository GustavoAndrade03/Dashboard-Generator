import { describe, expect, it } from "vitest";

import { createChart, normalizeSpec } from "@/lib/dashboard/chart-spec";
import {
  GRID_AREA_HEIGHT,
  GRID_COLS,
  GRID_GAP,
  GRID_ROWS,
  GRID_ROW_HEIGHT,
  PAGE_HEIGHT,
  SHEET_HEIGHT,
} from "@/lib/dashboard/page";
import { PALETTES, colorAt, getPalette } from "@/lib/dashboard/palettes";
import { SHEET_THEMES, getSheetTheme, sheetVars } from "@/lib/dashboard/themes";
import {
  TEMPLATES,
  applyTemplate,
  findFreeSlot,
  fillSheets,
  findSlotOnPage,
  getTemplate,
  normalizePages,
  pageCount,
} from "@/lib/dashboard/templates";
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

function placed(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  page = 0,
): PlacedChart {
  return { ...spec({ id }), layout: { page, x, y, w, h } };
}

describe("geometria da folha", () => {
  it("a grade cheia cabe na área útil da página", () => {
    const altura = GRID_ROWS * GRID_ROW_HEIGHT + (GRID_ROWS - 1) * GRID_GAP;
    expect(altura).toBeLessThanOrEqual(GRID_AREA_HEIGHT);
  });

  it("a folha desenhada cabe no papel, com folga", () => {
    // Um pixel a mais que a caixa da página faz o Chrome abrir uma folha em
    // branco depois de cada folha cheia.
    expect(SHEET_HEIGHT).toBeLessThan(PAGE_HEIGHT);
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
    const resultado = applyTemplate(template, [
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
    const resultado = applyTemplate(template, entrada);
    expect(resultado).toHaveLength(4);
    expect(pageCount(resultado)).toBe(1);
  });

  it("abre folhas novas em vez de descartar o excedente", () => {
    const entrada = Array.from({ length: 6 }, (_, i) => spec({ id: `c${i}` }));
    const resultado = applyTemplate(getTemplate("grade"), entrada);

    expect(resultado).toHaveLength(6);
    expect(pageCount(resultado)).toBe(2);
    expect(resultado.filter((chart) => chart.layout.page === 1).map((chart) => chart.id)).toEqual([
      "c4",
      "c5",
    ]);
  });

  it("ordena de cima para baixo, da esquerda para a direita dentro de cada folha", () => {
    const entrada = Array.from({ length: 6 }, (_, i) => spec({ id: `c${i}` }));
    const resultado = applyTemplate(template, entrada);
    for (let i = 1; i < resultado.length; i++) {
      const anterior = resultado[i - 1].layout;
      const atual = resultado[i].layout;
      if (anterior.page !== atual.page) continue;
      expect(anterior.y < atual.y || (anterior.y === atual.y && anterior.x <= atual.x)).toBe(true);
    }
  });

  it("nenhum gráfico ultrapassa o teto de linhas da folha", () => {
    const entrada = Array.from({ length: 20 }, (_, i) => spec({ id: `c${i}` }));
    for (const template of TEMPLATES) {
      for (const chart of applyTemplate(template, entrada)) {
        expect(chart.layout.y + chart.layout.h).toBeLessThanOrEqual(GRID_ROWS);
      }
    }
  });
});

describe("findFreeSlot", () => {
  const template = getTemplate("grade");

  it("acha a primeira vaga livre", () => {
    const ocupadas: PlacedChart[] = [placed("a", 0, 0, 6, 6)];
    expect(findFreeSlot(ocupadas, template, "large")).toEqual({ page: 0, x: 6, y: 0, w: 6, h: 6 });
  });

  it("abre a folha seguinte quando a atual está cheia", () => {
    const ocupadas = template.slots.map((slot, index) =>
      placed(`c${index}`, slot.x, slot.y, slot.w, slot.h),
    );
    expect(findFreeSlot(ocupadas, template, "large").page).toBe(1);
  });

  it("prefere uma vaga livre numa folha anterior a abrir outra", () => {
    const cheia = template.slots.map((slot, index) =>
      placed(`c${index}`, slot.x, slot.y, slot.w, slot.h),
    );
    const segunda = [...cheia, placed("d0", 0, 0, 6, 6, 1)];
    // A primeira está cheia, a segunda tem três vagas: nada de terceira folha.
    expect(findFreeSlot(segunda, template, "large").page).toBe(1);
  });
});

describe("folhas", () => {
  it("uma folha vazia deixa de existir, para o PDF não sair com página em branco", () => {
    const resultado = normalizePages([placed("a", 0, 0, 6, 6, 0), placed("b", 0, 0, 6, 6, 2)]);
    expect(resultado.map((chart) => chart.layout.page)).toEqual([0, 1]);
  });

  it("mantém as folhas quando todas têm gráfico", () => {
    const entrada = [placed("a", 0, 0, 6, 6, 0), placed("b", 0, 0, 6, 6, 1)];
    expect(normalizePages(entrada)).toEqual(entrada);
  });

  it("conta pelo menos uma folha mesmo sem nenhum gráfico", () => {
    expect(pageCount([])).toBe(1);
  });

  it("acha onde um gráfico cabe ao mudar de folha", () => {
    const ocupantes = [placed("a", 0, 0, 6, 6, 1)];
    expect(findSlotOnPage(ocupantes, 6, 6)).toEqual({ x: 6, y: 0 });
  });

  it("recusa quando a folha de destino não tem espaço", () => {
    const ocupantes = [placed("a", 0, 0, 12, 12, 1)];
    expect(findSlotOnPage(ocupantes, 6, 6)).toBeNull();
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

describe("temas da folha", () => {
  /** WCAG: contraste relativo entre duas cores hex. */
  function contraste(a: string, b: string): number {
    const luminancia = (hex: string) => {
      const canal = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
      return 0.2126 * canal[0] + 0.7152 * canal[1] + 0.0722 * canal[2];
    };
    const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
    return (claro + 0.05) / (escuro + 0.05);
  }

  it("todo tema tem papel claro", () => {
    // Um papel escuro exige um jogo próprio de matizes de série: as oito
    // atuais reprovam na banda de luminosidade sobre fundo escuro.
    for (const theme of SHEET_THEMES) {
      expect(contraste(theme.paper, "#ffffff"), theme.id).toBeLessThan(1.6);
    }
  });

  it("o texto do documento passa em contraste sobre o papel do tema", () => {
    for (const theme of SHEET_THEMES) {
      expect(contraste(theme.ink.primary, theme.surface), `${theme.id} título`).toBeGreaterThan(7);
      expect(
        contraste(theme.ink.secondary, theme.surface),
        `${theme.id} secundária`,
      ).toBeGreaterThan(4.5);
    }
  });

  it("a grade é recessiva, e a linha de base mais firme que ela", () => {
    for (const theme of SHEET_THEMES) {
      const grade = contraste(theme.ink.gridline, theme.surface);
      const base = contraste(theme.ink.baseline, theme.surface);
      expect(grade, `${theme.id} grade`).toBeLessThan(1.6);
      expect(base, `${theme.id} base`).toBeGreaterThan(grade);
    }
  });

  it("cai no tema padrão quando o id é desconhecido", () => {
    expect(getSheetTheme("inexistente").id).toBe(SHEET_THEMES[0].id);
    expect(getSheetTheme(undefined).id).toBe(SHEET_THEMES[0].id);
  });

  it("as variáveis da folha cobrem tudo que o documento pinta", () => {
    const vars = sheetVars(SHEET_THEMES[1]) as Record<string, string>;
    expect(Object.keys(vars).sort()).toEqual([
      "--baseline",
      "--gridline",
      "--ink-muted",
      "--ink-primary",
      "--ink-secondary",
      "--paper",
      "--surface",
    ]);
  });
});

describe("preencher a folha", () => {
  function naFolha(quantos: number, tipo: ChartSpec["type"] = "bar"): PlacedChart[] {
    return Array.from({ length: quantos }, (_, i) => ({
      ...spec({ id: `c${i}`, type: tipo }),
      layout: { page: 0, x: (i % 2) * 6, y: Math.floor(i / 2) * 3, w: 6, h: 3 },
    }));
  }

  /** A folha está cheia: sem sobreposição, sem buraco, e a grade toda ocupada. */
  function conferePreenchimento(charts: PlacedChart[]) {
    const celulas = new Map<string, number>();
    for (const chart of charts) {
      const { x, y, w, h } = chart.layout;
      expect(x + w, `${chart.id} passa da largura`).toBeLessThanOrEqual(GRID_COLS);
      expect(y + h, `${chart.id} passa da altura`).toBeLessThanOrEqual(GRID_ROWS);
      for (let cy = y; cy < y + h; cy++) {
        for (let cx = x; cx < x + w; cx++) {
          const chave = `${cx},${cy}`;
          celulas.set(chave, (celulas.get(chave) ?? 0) + 1);
        }
      }
    }
    for (const [chave, vezes] of celulas) {
      expect(vezes, `célula ${chave} ocupada mais de uma vez`).toBe(1);
    }
    expect(celulas.size, "sobrou célula vazia na folha").toBe(GRID_COLS * GRID_ROWS);
  }

  for (const quantos of [1, 2, 3, 4, 5, 6, 7, 8, 9, 12]) {
    it(`preenche a folha inteira com ${quantos} gráfico(s)`, () => {
      conferePreenchimento(fillSheets(naFolha(quantos)));
    });
  }

  it("preenche a folha com indicadores e gráficos juntos", () => {
    const mistura = [...naFolha(2, "kpi"), ...naFolha(3).map((c) => ({ ...c, id: `g${c.id}` }))];
    conferePreenchimento(fillSheets(mistura));
  });

  it("dá aos indicadores uma faixa mais baixa que a dos gráficos", () => {
    const mistura = [...naFolha(2, "kpi"), ...naFolha(2).map((c) => ({ ...c, id: `g${c.id}` }))];
    const resultado = fillSheets(mistura);
    const numero = resultado.find((c) => c.type === "kpi")!;
    const grafico = resultado.find((c) => c.type !== "kpi")!;
    expect(numero.layout.y).toBe(0);
    expect(numero.layout.h).toBeLessThan(grafico.layout.h);
  });

  it("preenche cada folha do dashboard, e não só a primeira", () => {
    const duas = [
      ...naFolha(3),
      ...naFolha(2).map((c) => ({ ...c, id: `p1${c.id}`, layout: { ...c.layout, page: 1 } })),
    ];
    const resultado = fillSheets(duas);
    conferePreenchimento(resultado.filter((c) => c.layout.page === 0));
    conferePreenchimento(resultado.filter((c) => c.layout.page === 1));
  });

  it("não perde nem duplica gráfico", () => {
    const entrada = naFolha(7);
    const resultado = fillSheets(entrada);
    expect(resultado.map((c) => c.id).sort()).toEqual(entrada.map((c) => c.id).sort());
  });

  it("respeita a ordem de leitura que a folha já tinha", () => {
    const resultado = fillSheets(naFolha(6));
    for (let i = 1; i < resultado.length; i++) {
      const antes = resultado[i - 1].layout;
      const agora = resultado[i].layout;
      expect(antes.y < agora.y || (antes.y === agora.y && antes.x < agora.x)).toBe(true);
    }
  });
});
