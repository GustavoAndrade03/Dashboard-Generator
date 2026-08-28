import { describe, expect, it } from "vitest";

import {
  buildColumnStats,
  coerceValue,
  inferColumnType,
  parseBooleanValue,
  parseDateValue,
  parseNumberValue,
  toIsoDate,
} from "@/lib/parsing/infer-types";

describe("parseNumberValue", () => {
  it("lê o formato brasileiro", () => {
    expect(parseNumberValue("1.234,56")).toBe(1234.56);
    expect(parseNumberValue("R$ 1.234,56")).toBe(1234.56);
    expect(parseNumberValue("1,5")).toBe(1.5);
    expect(parseNumberValue("1.234.567")).toBe(1234567);
  });

  it("lê o formato americano", () => {
    expect(parseNumberValue("1,234.56")).toBe(1234.56);
    expect(parseNumberValue("1234.56")).toBe(1234.56);
    expect(parseNumberValue("1,234,567")).toBe(1234567);
  });

  it("mantém percentuais na escala original", () => {
    expect(parseNumberValue("45%")).toBe(45);
  });

  it("entende negativo contábil e sinal", () => {
    expect(parseNumberValue("(1.234)")).toBe(-1234);
    expect(parseNumberValue("-42")).toBe(-42);
  });

  it("rejeita texto", () => {
    expect(parseNumberValue("total")).toBeNull();
    expect(parseNumberValue("")).toBeNull();
    expect(parseNumberValue("12abc")).toBeNull();
  });
});

describe("parseDateValue", () => {
  it("lê ISO", () => {
    expect(toIsoDate(parseDateValue("2024-03-15")!)).toBe("2024-03-15");
  });

  it("assume dd/mm em datas ambíguas", () => {
    expect(toIsoDate(parseDateValue("03/04/2024")!)).toBe("2024-04-03");
  });

  it("cai para mm/dd quando dd/mm é impossível", () => {
    expect(toIsoDate(parseDateValue("12/25/2024")!)).toBe("2024-12-25");
  });

  it("aceita separadores variados e ano de dois dígitos", () => {
    expect(toIsoDate(parseDateValue("15-03-2024")!)).toBe("2024-03-15");
    expect(toIsoDate(parseDateValue("15.03.24")!)).toBe("2024-03-15");
  });

  it("rejeita datas inválidas e números soltos", () => {
    expect(parseDateValue("32/01/2024")).toBeNull();
    expect(parseDateValue("2024-13-01")).toBeNull();
    expect(parseDateValue(45000)).toBeNull();
  });
});

describe("parseBooleanValue", () => {
  it("entende português e inglês", () => {
    expect(parseBooleanValue("Sim")).toBe(true);
    expect(parseBooleanValue("NÃO")).toBe(false);
    expect(parseBooleanValue("true")).toBe(true);
  });

  it("não trata 0/1 como booleano", () => {
    expect(parseBooleanValue("1")).toBeNull();
    expect(parseBooleanValue("0")).toBeNull();
  });
});

describe("inferColumnType", () => {
  it("reconhece datas", () => {
    const result = inferColumnType(["01/01/2024", "02/01/2024", "03/01/2024", "04/01/2024"]);
    expect(result.type).toBe("date");
  });

  it("reconhece números mesmo com um valor sujo", () => {
    const result = inferColumnType(["10", "20", "30", "40", "n/d"]);
    expect(result.type).toBe("number");
    expect(result.confidence).toBeCloseTo(0.8);
  });

  it("reconhece categorias de baixa cardinalidade", () => {
    const result = inferColumnType(["Sul", "Norte", "Sul", "Norte", "Sul", "Leste"]);
    expect(result.type).toBe("category");
  });

  it("reconhece identificadores textuais", () => {
    const values = Array.from({ length: 12 }, (_, index) => `PED-${1000 + index}`);
    expect(inferColumnType(values).type).toBe("identifier");
  });

  it("trata sequência de inteiros consecutivos como identificador", () => {
    const values = Array.from({ length: 10 }, (_, index) => index + 1);
    expect(inferColumnType(values).type).toBe("identifier");
  });

  it("não confunde quantidade com identificador", () => {
    expect(inferColumnType([5, 3, 12, 7, 40, 3, 900, 21]).type).toBe("number");
  });

  it("reconhece coluna vazia", () => {
    expect(inferColumnType([null, "", "   "]).type).toBe("empty");
  });
});

describe("coerceValue", () => {
  it("normaliza datas para ISO", () => {
    expect(coerceValue("15/03/2024", "date")).toBe("2024-03-15");
  });

  it("normaliza números brasileiros", () => {
    expect(coerceValue("1.234,50", "number")).toBe(1234.5);
  });

  it("devolve null quando o valor não casa com o tipo", () => {
    expect(coerceValue("abc", "number")).toBeNull();
  });
});

describe("buildColumnStats", () => {
  it("calcula min, max e média de colunas numéricas", () => {
    const stats = buildColumnStats([10, 20, 30, null], "number");
    expect(stats).toMatchObject({
      nonEmptyCount: 3,
      distinctCount: 3,
      numericMin: 10,
      numericMax: 30,
      numericMean: 20,
    });
  });

  it("calcula intervalo de datas", () => {
    const stats = buildColumnStats(["2024-03-01", "2024-01-15"], "date");
    expect(stats.dateMin).toBe("2024-01-15");
    expect(stats.dateMax).toBe("2024-03-01");
  });
});
