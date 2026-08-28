import { describe, expect, it } from "vitest";

import { buildHeuristicCharts } from "@/lib/ai-suggestions/fallback-charts";
import { buildChartData } from "@/lib/dashboard/aggregate";
import { normalizeSpec } from "@/lib/dashboard/chart-spec";
import type { ChartSpec } from "@/lib/dashboard/types";
import { buildParsedTable, buildSchemaSummary } from "@/lib/parsing/schema-builder";
import type { ParsedWorkbook } from "@/lib/parsing/types";

const SALES = [
  ["Data", "Região", "Faturamento"],
  ["15/01/2024", "Sul", 100],
  ["20/01/2024", "Norte", 200],
  ["10/02/2024", "Sul", 300],
  ["25/02/2024", "Norte", 150],
  ["05/03/2024", "Leste", 250],
];

function workbook(): ParsedWorkbook {
  return {
    source: { kind: "xlsx-upload", label: "vendas.xlsx", config: {} },
    tables: [buildParsedTable({ name: "Vendas", cells: SALES, merges: [] }, 0)],
  };
}

describe("buildHeuristicCharts", () => {
  it("propõe série temporal, comparação e indicador", () => {
    const charts = buildHeuristicCharts(buildSchemaSummary(workbook()));
    const types = charts.map((chart) => chart.type);

    expect(types).toContain("line");
    expect(types).toContain("bar");
    expect(types).toContain("kpi");
    expect(charts.every((chart) => chart.origin === "heuristic")).toBe(true);
  });

  it("cai para contagem quando não há coluna numérica", () => {
    const table = buildParsedTable(
      {
        name: "Chamados",
        cells: [
          ["Categoria", "Status"],
          ["Rede", "Aberto"],
          ["Rede", "Fechado"],
          ["Sistema", "Aberto"],
          ["Sistema", "Aberto"],
        ],
        merges: [],
      },
      0,
    );
    const charts = buildHeuristicCharts(
      buildSchemaSummary({
        source: { kind: "xlsx-upload", label: "chamados.xlsx", config: {} },
        tables: [table],
      }),
    );

    expect(charts).toHaveLength(1);
    expect(charts[0]).toMatchObject({ type: "bar", aggregation: "count", valueKeys: [] });
  });

  it("só referencia colunas que existem no schema", () => {
    const parsed = workbook();
    const keys = new Set(parsed.tables[0].schema.columns.map((column) => column.key));
    const charts = buildHeuristicCharts(buildSchemaSummary(parsed));

    for (const chart of charts) {
      if (chart.categoryKey) expect(keys.has(chart.categoryKey)).toBe(true);
      for (const key of chart.valueKeys) expect(keys.has(key)).toBe(true);
    }
  });
});

describe("buildChartData", () => {
  const parsed = workbook();
  const columns = parsed.tables[0].schema.columns;
  const dateKey = columns[0].key;
  const regionKey = columns[1].key;
  const valueKey = columns[2].key;

  const base: ChartSpec = {
    id: "c1",
    type: "bar",
    title: "Teste",
    tableKey: "t0",
    categoryKey: regionKey,
    valueKeys: [valueKey],
    aggregation: "sum",
    limit: 12,
    rationale: "",
    origin: "heuristic",
  };

  it("agrupa por categoria e ordena por magnitude", () => {
    const data = buildChartData(parsed, base);
    expect(data.rows.map((row) => row.label)).toEqual(["Sul", "Norte", "Leste"]);
    expect(data.rows[0][valueKey]).toBe(400);
  });

  it("agrupa datas por mês em ordem cronológica", () => {
    const data = buildChartData(parsed, {
      ...base,
      type: "line",
      categoryKey: dateKey,
      granularity: "month",
      limit: 60,
    });
    expect(data.rows.map((row) => row.label)).toEqual(["01/2024", "02/2024", "03/2024"]);
    expect(data.rows[0][valueKey]).toBe(300);
  });

  it("conta linhas quando não há coluna de valor", () => {
    const data = buildChartData(parsed, { ...base, valueKeys: [], aggregation: "count" });
    expect(data.series[0].label).toBe("Quantidade");
    expect(data.rows[0].__count).toBe(2);
  });

  it("calcula KPI sobre a coluna escolhida", () => {
    const data = buildChartData(parsed, { ...base, type: "kpi", categoryKey: null });
    expect(data.kpi?.value).toBe(1000);
  });

  it("reporta erro legível quando a coluna sumiu", () => {
    const data = buildChartData(parsed, { ...base, categoryKey: "inexistente" });
    expect(data.error).toBeTruthy();
  });
});

describe("linhas de fechamento", () => {
  const comSubtotal: ParsedWorkbook = {
    source: { kind: "xlsx-upload", label: "relatorio.xlsx", config: {} },
    tables: [
      buildParsedTable(
        {
          name: "Regime",
          cells: [
            ["Indicador", "TOTAL"],
            ["Provisórios", 100],
            ["Fechado", 200],
            ["Subtotal", 300],
          ],
          merges: [],
        },
        0,
      ),
    ],
  };
  const chaves = comSubtotal.tables[0].schema.columns.map((column) => column.key);
  const base: ChartSpec = {
    id: "c1",
    type: "bar",
    title: "Teste",
    tableKey: "t0",
    categoryKey: chaves[0],
    valueKeys: [chaves[1]],
    aggregation: "sum",
    limit: 12,
    rationale: "",
    origin: "heuristic",
  };

  it("deixa a linha de subtotal de fora por padrão", () => {
    const data = buildChartData(comSubtotal, base);
    expect(data.rows.map((row) => row.label)).toEqual(["Fechado", "Provisórios"]);
  });

  it("inclui quando o usuário pede", () => {
    const data = buildChartData(comSubtotal, { ...base, includeTotalRows: true });
    expect(data.rows.map((row) => row.label)).toContain("Subtotal");
  });
});

describe("recorte por indicador", () => {
  const matriz: ParsedWorkbook = {
    source: { kind: "xlsx-upload", label: "relatorio.xlsx", config: {} },
    tables: [
      buildParsedTable(
        {
          name: "Vagas",
          cells: [
            [null, "PAMC", "CPMBV", "TOTAL"],
            ["DÉFICIT DE VAGAS", -693, -274, -1093],
            ["VAGAS DISPONÍVEIS", 0, 0, 181],
            ["CAPACIDADE GERAL", 1094, 478, 3062],
          ],
          merges: [],
        },
        0,
      ),
    ],
  };
  const [indicador, pamc, cpmbv, total] = matriz.tables[0].schema.columns.map((c) => c.key);

  const base: ChartSpec = {
    id: "c1",
    type: "bar",
    title: "Teste",
    tableKey: "t0",
    categoryKey: indicador,
    valueKeys: [total],
    aggregation: "sum",
    limit: 12,
    rationale: "",
    origin: "user",
  };

  it("nomeia a coluna sem cabeçalho de indicadores", () => {
    expect(matriz.tables[0].schema.columns[0].label).toBe("Indicador");
  });

  it("sem recorte mostra todos os indicadores", () => {
    expect(buildChartData(matriz, base).rows).toHaveLength(3);
  });

  it("mostra apenas o indicador escolhido", () => {
    const data = buildChartData(matriz, {
      ...base,
      filter: { columnKey: indicador, values: ["DÉFICIT DE VAGAS"] },
    });
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0][total]).toBe(-1093);
  });

  it("um indicador com várias unidades vira um gráfico por unidade", () => {
    const data = buildChartData(matriz, {
      ...base,
      valueKeys: [pamc, cpmbv, total],
      filter: { columnKey: indicador, values: ["DÉFICIT DE VAGAS"] },
    });
    expect(data.rows.map((row) => row.label)).toEqual(["PAMC", "CPMBV", "TOTAL"]);
    expect(data.rows[0].valor).toBe(-693);
  });

  it("recorta também o KPI, e o indicador nomeia o número", () => {
    const data = buildChartData(matriz, {
      ...base,
      type: "kpi",
      valueKeys: [pamc],
      filter: { columnKey: indicador, values: ["DÉFICIT DE VAGAS"] },
    });
    expect(data.kpi?.value).toBe(-693);
    expect(data.kpi?.label).toBe("DÉFICIT DE VAGAS · PAMC");
  });

  it("descarta o recorte quando o indicador some dos dados", () => {
    const table = matriz.tables[0];
    const normalizado = normalizeSpec(
      { ...base, filter: { columnKey: indicador, values: ["INDICADOR QUE NÃO EXISTE"] } },
      table,
    );
    expect(normalizado.filter).toBeUndefined();
  });
});
