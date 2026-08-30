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
    expect(data.series).toHaveLength(1);
    expect(data.rows[0][data.series[0].key]).toBe(-693);
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

  it("a tabela traz o indicador como primeira coluna", () => {
    const data = buildChartData(matriz, { ...base, type: "table", valueKeys: [pamc, total] });

    expect(data.categoryLabel).toBe("Indicador");
    expect(data.rows[0].label).toBe("DÉFICIT DE VAGAS");
    expect(data.rows[0][pamc]).toBe(-693);
    // O indicador é a coluna descritiva, não uma série de valores.
    expect(data.series.map((serie) => serie.key)).toEqual([pamc, total]);
  });

  it("não repete o indicador entre os valores quando nenhuma coluna foi escolhida", () => {
    const data = buildChartData(matriz, { ...base, type: "table", valueKeys: [] });

    expect(data.categoryLabel).toBe("Indicador");
    expect(data.series.map((serie) => serie.key)).toEqual([pamc, cpmbv, total]);
  });

  it("a tabela também respeita o recorte por indicador", () => {
    const data = buildChartData(matriz, {
      ...base,
      type: "table",
      valueKeys: [total],
      filter: { columnKey: indicador, values: ["CAPACIDADE GERAL"] },
    });

    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].label).toBe("CAPACIDADE GERAL");
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

describe("eixo, empilhamento e porcentagem", () => {
  const matriz: ParsedWorkbook = {
    source: { kind: "xlsx-upload", label: "relatorio.xlsx", config: {} },
    tables: [
      buildParsedTable(
        {
          name: "Vagas",
          cells: [
            [null, "PAMC", "CPMBV", "TOTAL"],
            ["DÉFICIT DE VAGAS", -693, -274, -1093],
            ["VAGAS DISPONÍVEIS", 20, 30, 181],
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
    valueKeys: [pamc, cpmbv],
    aggregation: "sum",
    limit: 12,
    rationale: "",
    origin: "user",
  };

  it("por padrão põe os indicadores no eixo", () => {
    const data = buildChartData(matriz, base);
    expect(data.rows.map((row) => row.label)).toEqual(["VAGAS DISPONÍVEIS", "DÉFICIT DE VAGAS"]);
    expect(data.series.map((serie) => serie.label)).toEqual(["PAMC", "CPMBV"]);
  });

  it("com o eixo nas colunas, indicadores viram séries", () => {
    const data = buildChartData(matriz, { ...base, axis: "columns" });
    expect(data.rows.map((row) => row.label)).toEqual(["PAMC", "CPMBV"]);
    expect(data.series.map((serie) => serie.label)).toEqual([
      "DÉFICIT DE VAGAS",
      "VAGAS DISPONÍVEIS",
    ]);
    const linhaPamc = data.rows[0];
    expect(linhaPamc[data.series[0].key]).toBe(-693);
    expect(linhaPamc[data.series[1].key]).toBe(20);
  });

  it("o eixo escolhido vence o automático", () => {
    // Um indicador só: o automático transporia, mas "rows" foi pedido.
    const data = buildChartData(matriz, {
      ...base,
      axis: "rows",
      filter: { columnKey: indicador, values: ["DÉFICIT DE VAGAS"] },
    });
    expect(data.rows.map((row) => row.label)).toEqual(["DÉFICIT DE VAGAS"]);
  });

  it("com uma coluna só, a porcentagem é a fatia no total do gráfico", () => {
    const data = buildChartData(matriz, { ...base, valueKeys: [pamc], valueMode: "percent" });
    const deficit = data.rows.find((row) => row.label === "DÉFICIT DE VAGAS")!;
    const disponiveis = data.rows.find((row) => row.label === "VAGAS DISPONÍVEIS")!;
    // -693 e 20 sobre 713: dividir pela própria série daria 100% em toda barra.
    expect(deficit[pamc]).toBeCloseTo((-693 / 713) * 100, 3);
    expect(disponiveis[pamc]).toBeCloseTo((20 / 713) * 100, 3);
  });

  it("em porcentagem com várias colunas, cada valor é a fatia na barra", () => {
    const data = buildChartData(matriz, { ...base, valueMode: "percent" });
    const deficit = data.rows.find((row) => row.label === "DÉFICIT DE VAGAS")!;
    // 693 e 274 sobre 967: participacao pela magnitude, com o sinal mantido.
    expect(deficit[pamc]).toBeCloseTo((-693 / 967) * 100, 3);
    expect(deficit[cpmbv]).toBeCloseTo((-274 / 967) * 100, 3);
  });

  it("a coluna de total fica fora do divisor da porcentagem", () => {
    const comTotal = buildChartData(matriz, {
      ...base,
      valueKeys: [pamc, cpmbv, total],
      valueMode: "percent",
    });
    const deficit = comTotal.rows.find((row) => row.label === "DÉFICIT DE VAGAS")!;
    // Se TOTAL entrasse na conta, o divisor dobraria e isto sairia pela metade.
    expect(deficit[pamc]).toBeCloseTo((-693 / 967) * 100, 3);
  });
});

describe("comparação entre quadros", () => {
  const dois: ParsedWorkbook = {
    source: { kind: "xlsx-upload", label: "relatorio.xlsx", config: {} },
    tables: [
      buildParsedTable(
        {
          name: "Vagas",
          cells: [
            [null, "PAMC", "CPMBV"],
            ["DÉFICIT DE VAGAS", -693, -274],
            ["VAGAS DISPONÍVEIS", 20, 30],
          ],
          merges: [],
        },
        0,
      ),
      buildParsedTable(
        {
          name: "Saúde",
          // Mesmas unidades, em outra ordem: o casamento é pelo nome da coluna.
          cells: [
            [null, "CPMBV", "PAMC"],
            ["DÉFICIT DE VAGAS", -140, -312],
            ["OUTRO INDICADOR", 1, 2],
          ],
          merges: [],
        },
        1,
      ),
    ],
  };
  const [indicador, pamc, cpmbv] = dois.tables[0].schema.columns.map((c) => c.key);

  const base: ChartSpec = {
    id: "c1",
    type: "bar",
    title: "Teste",
    tableKey: "t0",
    categoryKey: indicador,
    valueKeys: [pamc, cpmbv],
    aggregation: "sum",
    limit: 12,
    filter: { columnKey: indicador, values: ["DÉFICIT DE VAGAS"] },
    compareTables: ["t1"],
    rationale: "",
    origin: "user",
  };

  it("põe as colunas no eixo e cada quadro como série", () => {
    const data = buildChartData(dois, base);
    expect(data.rows.map((row) => row.label)).toEqual(["PAMC", "CPMBV"]);
    expect(data.series).toHaveLength(2);
  });

  it("casa as colunas pelo nome, não pela posição", () => {
    const data = buildChartData(dois, base);
    const [quadroA, quadroB] = data.series.map((serie) => serie.key);
    const linhaPamc = data.rows[0];
    expect(linhaPamc[quadroA]).toBe(-693);
    // No segundo quadro PAMC é a última coluna; por posição sairia -140.
    expect(linhaPamc[quadroB]).toBe(-312);
  });

  it("devolve nulo quando o quadro comparado não tem aquela coluna", () => {
    const semColuna = buildChartData(dois, { ...base, compareTables: ["t1"], valueKeys: [pamc] });
    expect(semColuna.rows).toHaveLength(1);
    expect(semColuna.rows[0].label).toBe("PAMC");
  });

  it("cobra as colunas antes de tentar comparar", () => {
    const data = buildChartData(dois, { ...base, valueKeys: [] });
    expect(data.error).toBeTruthy();
  });

  it("ignora o próprio quadro na lista de comparados", () => {
    const resultado = normalizeSpec(
      { ...base, compareTables: ["t0", "t1"] },
      dois.tables[0],
      dois.tables,
    );
    expect(resultado.compareTables).toEqual(["t1"]);
  });

  it("descarta o quadro comparado que sumiu da planilha", () => {
    const resultado = normalizeSpec(
      { ...base, compareTables: ["quadro-que-nao-existe"] },
      dois.tables[0],
      dois.tables,
    );
    expect(resultado.compareTables).toBeUndefined();
  });
});
