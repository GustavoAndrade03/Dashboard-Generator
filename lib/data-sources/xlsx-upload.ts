/**
 * Fonte de dados: upload de arquivo .xlsx (única implementação no MVP).
 *
 * A responsabilidade aqui é estritamente ler o arquivo e devolver grades
 * brutas. Nenhuma heurística de estrutura mora neste arquivo — isso é da
 * Camada 1, em /lib/parsing.
 */

import { Workbook, type Cell, type CellValue as ExcelCellValue } from "exceljs";

import type {
  DataSource,
  DataSourceDescriptor,
  MergeRange,
  RawTable,
  RawValue,
} from "@/lib/data-sources/types";

/** Limites defensivos: planilhas grandes demais são truncadas, não rejeitadas. */
const MAX_SHEETS = 10;
const MAX_ROWS = 25000;
const MAX_COLUMNS = 200;

/** Converte "B" em 1, "AA" em 26 (0-based). */
function columnIndexFromLetters(letters: string): number {
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function decodeAddress(address: string): { row: number; col: number } | null {
  const match = /^\$?([A-Z]+)\$?(\d+)$/.exec(address);
  if (!match) return null;
  return { row: Number(match[2]) - 1, col: columnIndexFromLetters(match[1]) };
}

/**
 * Achata os formatos de célula do ExcelJS (fórmula, rich text, hyperlink,
 * erro) em um valor simples. Fórmulas viram o resultado calculado; erros do
 * Excel (#N/A, #DIV/0!) viram vazio, para não contaminarem a inferência.
 */
export function toRawValue(value: ExcelCellValue): RawValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "object") return null;

  if ("richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  if ("hyperlink" in value) {
    return value.text ?? value.hyperlink ?? null;
  }
  if ("formula" in value || "sharedFormula" in value) {
    const result = value.result;
    if (result === null || result === undefined) return null;
    if (typeof result === "object" && "error" in result) return null;
    return result;
  }
  return null;
}

function collectMerge(merges: Map<string, MergeRange>, cell: Cell, row: number, col: number): void {
  if (!cell.isMerged) return;
  const master = decodeAddress(cell.master.address);
  if (!master) return;
  const key = cell.master.address;
  const current = merges.get(key);
  if (!current) {
    merges.set(key, { top: row, left: col, bottom: row, right: col });
    return;
  }
  current.top = Math.min(current.top, row);
  current.left = Math.min(current.left, col);
  current.bottom = Math.max(current.bottom, row);
  current.right = Math.max(current.right, col);
}

export interface XlsxUploadInput {
  fileName: string;
  contents: Buffer;
}

export class XlsxUploadDataSource implements DataSource {
  readonly descriptor: DataSourceDescriptor;
  /** Um arquivo enviado não pode ser relido da origem; Google Sheets poderá. */
  readonly supportsRefresh = false;

  private readonly contents: Buffer;

  constructor(input: XlsxUploadInput) {
    this.contents = input.contents;
    this.descriptor = {
      kind: "xlsx-upload",
      label: input.fileName,
      config: { fileName: input.fileName, sizeBytes: input.contents.byteLength },
    };
  }

  async fetchTables(): Promise<RawTable[]> {
    const workbook = new Workbook();
    // O exceljs declara um `Buffer` global próprio (interface Buffer extends
    // ArrayBuffer), incompatível com o Buffer do @types/node. Em runtime a
    // biblioteca aceita um Buffer normalmente.
    await workbook.xlsx.load(this.contents as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    const tables: RawTable[] = [];
    for (const worksheet of workbook.worksheets.slice(0, MAX_SHEETS)) {
      if (worksheet.state === "hidden" || worksheet.state === "veryHidden") continue;

      const cells: RawValue[][] = [];
      const merges = new Map<string, MergeRange>();

      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (rowNumber > MAX_ROWS) return;
        const values: RawValue[] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber > MAX_COLUMNS) return;
          while (values.length < colNumber - 1) values.push(null);
          values[colNumber - 1] = toRawValue(cell.value);
          collectMerge(merges, cell, rowNumber - 1, colNumber - 1);
        });
        while (cells.length < rowNumber - 1) cells.push([]);
        cells[rowNumber - 1] = values;
      });

      const hasContent = cells.some((row) => row.some((cell) => cell !== null && cell !== ""));
      if (!hasContent) continue;

      tables.push({ name: worksheet.name, cells, merges: [...merges.values()] });
    }

    return tables;
  }
}
