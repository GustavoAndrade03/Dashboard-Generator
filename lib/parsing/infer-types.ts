/**
 * Inferência de tipo por coluna.
 *
 * Os parsers toleram as convenções que aparecem em planilhas brasileiras
 * (1.234,56 / R$ / 45% / dd-mm-aaaa), porque é o formato do público-alvo.
 * Nada aqui depende de IA — ver CLAUDE.md, seção 4.1.
 */

import type { RawValue } from "@/lib/data-sources/types";
import { isBlank } from "@/lib/parsing/normalize";
import type { CellValue, ColumnStats, ColumnType } from "@/lib/parsing/types";

const TRUE_WORDS = new Set(["true", "verdadeiro", "sim", "s", "yes", "y"]);
const FALSE_WORDS = new Set(["false", "falso", "nao", "não", "n", "no"]);

/** Fração mínima de valores que precisam casar para o tipo ser aceito. */
const TYPE_THRESHOLD = 0.8;

export function parseBooleanValue(value: RawValue): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (TRUE_WORDS.has(normalized)) return true;
  if (FALSE_WORDS.has(normalized)) return false;
  return null;
}

/**
 * Aceita "1.234,56", "1,234.56", "R$ 1.234,56", "45%" e "(1.234)" (negativo
 * contábil). Percentuais são mantidos na escala original (45% vira 45), que é
 * o que o usuário espera ver plotado.
 */
export function parseNumberValue(value: RawValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  let text = value.trim();
  if (text === "") return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }

  text = text.replace(/[R$€£\s %]/gi, "");
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    // O separador que aparece por último é o decimal.
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    text = text.split(thousandSeparator).join("");
    text = text.replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    // Só vírgulas: milhar quando houver mais de uma, senão decimal.
    text = text.split(",").length > 2 ? text.split(",").join("") : text.replace(",", ".");
  } else if (lastDot >= 0) {
    // Só pontos: milhar apenas quando o formato for agrupado (1.234.567).
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.split(".").join("");
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function utcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/**
 * Aceita Date nativo, ISO (YYYY-MM-DD) e formatos separados por / . ou -.
 * Em caso de ambiguidade (03/04/2024) assume dd/mm — convenção brasileira.
 */
export function parseDateValue(value: RawValue): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;

  const text = value.trim();
  if (text === "") return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(text);
  if (iso) return utcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const ymd = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(text);
  if (ymd) return utcDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));

  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  if (dmy) {
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return utcDate(year, second, first) ?? utcDate(year, first, second);
  }

  return null;
}

/** Data em ISO; omite a parte de hora quando ela é meia-noite UTC. */
export function toIsoDate(date: Date): string {
  const hasTime =
    date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0;
  return hasTime ? date.toISOString() : date.toISOString().slice(0, 10);
}

export interface TypeInference {
  type: ColumnType;
  confidence: number;
}

/**
 * Só trata número como identificador quando ele parece uma sequência de
 * códigos (inteiros distintos e quase consecutivos). Sem essa restrição,
 * colunas de quantidade seriam classificadas erradas com frequência.
 */
function looksLikeNumericId(numbers: number[]): boolean {
  if (numbers.length < 5) return false;
  if (!numbers.every((value) => Number.isInteger(value) && value >= 0)) return false;
  if (new Set(numbers).size !== numbers.length) return false;
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return max - min + 1 <= numbers.length * 1.2;
}

export function inferColumnType(values: RawValue[]): TypeInference {
  const present = values.filter((value) => !isBlank(value));
  if (present.length === 0) return { type: "empty", confidence: 1 };

  const total = present.length;
  const dateCount = present.filter((value) => parseDateValue(value) !== null).length;
  const numberCount = present.filter((value) => parseNumberValue(value) !== null).length;
  const booleanCount = present.filter((value) => parseBooleanValue(value) !== null).length;

  // Booleano vem antes de número: "0"/"1" não contam como booleano, então não há conflito.
  if (booleanCount / total >= 0.9) {
    return { type: "boolean", confidence: booleanCount / total };
  }
  if (dateCount / total >= TYPE_THRESHOLD && dateCount >= numberCount) {
    return { type: "date", confidence: dateCount / total };
  }
  if (numberCount / total >= TYPE_THRESHOLD) {
    const numbers = present
      .map((value) => parseNumberValue(value))
      .filter((value): value is number => value !== null);
    if (looksLikeNumericId(numbers)) return { type: "identifier", confidence: 0.6 };
    return { type: "number", confidence: numberCount / total };
  }

  const distinct = new Set(present.map((value) => String(value).trim())).size;
  const distinctRatio = distinct / total;
  if (distinctRatio >= 0.95 && total >= 8) {
    return { type: "identifier", confidence: distinctRatio };
  }
  return { type: "category", confidence: Math.min(1, 1.2 - distinctRatio) };
}

export function coerceValue(value: RawValue, type: ColumnType): CellValue {
  if (isBlank(value)) return null;
  switch (type) {
    case "date": {
      const date = parseDateValue(value);
      return date ? toIsoDate(date) : String(value).trim();
    }
    case "number": {
      const parsed = parseNumberValue(value);
      return parsed === null ? null : parsed;
    }
    case "boolean": {
      const parsed = parseBooleanValue(value);
      return parsed === null ? null : parsed;
    }
    case "empty":
      return null;
    default:
      return value instanceof Date ? toIsoDate(value) : String(value).trim();
  }
}

export function buildColumnStats(values: CellValue[], type: ColumnType): ColumnStats {
  const present = values.filter((value) => value !== null && value !== "");
  const stats: ColumnStats = {
    totalCount: values.length,
    nonEmptyCount: present.length,
    distinctCount: new Set(present.map((value) => String(value))).size,
  };

  if (type === "number") {
    const numbers = present.filter((value): value is number => typeof value === "number");
    if (numbers.length > 0) {
      stats.numericMin = Math.min(...numbers);
      stats.numericMax = Math.max(...numbers);
      stats.numericMean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    }
  }

  if (type === "date") {
    const dates = present.map((value) => String(value)).sort();
    if (dates.length > 0) {
      stats.dateMin = dates[0];
      stats.dateMax = dates[dates.length - 1];
    }
  }

  return stats;
}
