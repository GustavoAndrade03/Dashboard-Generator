import { describe, expect, it } from "vitest";

import type { RawTable, RawValue } from "@/lib/data-sources/types";
import { detectHeader } from "@/lib/parsing/detect-headers";
import { applyMerges, columnLetter, normalizeGrid } from "@/lib/parsing/normalize";
import { buildParsedTable } from "@/lib/parsing/schema-builder";

function table(cells: RawValue[][], merges: RawTable["merges"] = []): RawTable {
  return { name: "Planilha1", cells, merges };
}

describe("columnLetter", () => {
  it("segue a notação de planilha", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
  });
});

describe("applyMerges", () => {
  it("replica o valor da célula-mestra pela região", () => {
    const cells: RawValue[][] = [
      ["Trimestre", null, null],
      ["Jan", "Fev", "Mar"],
    ];
    const merged = applyMerges(cells, [{ top: 0, left: 0, bottom: 0, right: 2 }]);
    expect(merged[0]).toEqual(["Trimestre", "Trimestre", "Trimestre"]);
  });

  it("não sobrescreve células já preenchidas", () => {
    const cells: RawValue[][] = [["A", "B"]];
    const merged = applyMerges(cells, [{ top: 0, left: 0, bottom: 0, right: 1 }]);
    expect(merged[0]).toEqual(["A", "B"]);
  });
});

describe("normalizeGrid", () => {
  it("remove linhas e colunas vazias preservando os índices originais", () => {
    const grid = normalizeGrid(
      table([
        [null, null, null],
        [null, "Nome", "Valor"],
        [null, "Ana", 10],
        [null, null, null],
        [null, "Bia", 20],
      ]),
    );

    expect(grid.cells).toEqual([
      ["Nome", "Valor"],
      ["Ana", 10],
      ["Bia", 20],
    ]);
    // A coluna A estava vazia: as mantidas são B e C.
    expect(grid.columnIndexes).toEqual([1, 2]);
    expect(grid.rowIndexes).toEqual([1, 2, 4]);
  });

  it("uniformiza linhas de larguras diferentes", () => {
    const grid = normalizeGrid(table([["a", "b", "c"], ["d"]]));
    expect(grid.cells[1]).toEqual(["d", null, null]);
  });
});

describe("detectHeader", () => {
  it("encontra o cabeçalho abaixo de linhas de título", () => {
    const grid = normalizeGrid(
      table([
        ["Relatório de vendas 2024", null, null],
        [null, null, null],
        ["Data", "Regiao", "Valor"],
        ["01/01/2024", "Sul", 100],
        ["02/01/2024", "Norte", 200],
        ["03/01/2024", "Sul", 300],
      ]),
    );
    const header = detectHeader(grid.cells, grid.columnIndexes);
    expect(header.labels).toEqual(["Data", "Regiao", "Valor"]);
    expect(header.dataStartRow).toBe(header.rowIndex! + 1);
  });

  it("gera nomes quando não há cabeçalho plausível", () => {
    const grid = normalizeGrid(
      table([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ]),
    );
    const header = detectHeader(grid.cells, grid.columnIndexes);
    expect(header.rowIndex).toBeNull();
    expect(header.labels).toEqual(["Coluna A", "Coluna B", "Coluna C"]);
    expect(header.dataStartRow).toBe(0);
  });

  it("combina cabeçalho de dois níveis vindo de células mescladas", () => {
    const grid = normalizeGrid(
      table(
        [
          ["1o Trimestre", null, "2o Trimestre", null],
          ["Meta", "Real", "Meta", "Real"],
          [10, 12, 20, 18],
          [30, 28, 40, 44],
        ],
        [
          { top: 0, left: 0, bottom: 0, right: 1 },
          { top: 0, left: 2, bottom: 0, right: 3 },
        ],
      ),
    );
    const header = detectHeader(grid.cells, grid.columnIndexes);
    expect(header.labels).toEqual([
      "1o Trimestre - Meta",
      "1o Trimestre - Real",
      "2o Trimestre - Meta",
      "2o Trimestre - Real",
    ]);
  });

  it("desambigua rótulos repetidos", () => {
    const grid = normalizeGrid(
      table([
        ["Valor", "Valor", "Nome"],
        [1, 2, "Ana"],
        [3, 4, "Bia"],
        [5, 6, "Caio"],
      ]),
    );
    const header = detectHeader(grid.cells, grid.columnIndexes);
    expect(header.labels).toEqual(["Valor", "Valor (2)", "Nome"]);
  });
});

describe("buildParsedTable", () => {
  it("produz schema e linhas a partir de uma planilha desestruturada", () => {
    const parsed = buildParsedTable(
      table([
        ["Vendas por região", null, null],
        [null, null, null],
        ["Data", "Região", "Faturamento"],
        ["01/01/2024", "Sul", "1.000,50"],
        ["02/01/2024", "Norte", "2.000,00"],
        ["03/01/2024", "Sul", "1.500,25"],
      ]),
      0,
    );

    expect(parsed.schema.columns.map((column) => column.label)).toEqual([
      "Data",
      "Região",
      "Faturamento",
    ]);
    expect(parsed.schema.columns.map((column) => column.type)).toEqual([
      "date",
      "category",
      "number",
    ]);
    expect(parsed.schema.rowCount).toBe(3);
    expect(parsed.rows[0]).toEqual(["2024-01-01", "Sul", 1000.5]);
  });

  it("avisa quando não encontra cabeçalho", () => {
    const parsed = buildParsedTable(
      table([
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
      ]),
      0,
    );
    expect(parsed.schema.headerRowIndex).toBeNull();
    expect(parsed.schema.warnings.join(" ")).toContain("cabeçalho");
  });
});
