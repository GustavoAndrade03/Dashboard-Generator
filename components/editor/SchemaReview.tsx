"use client";

/**
 * Revisão do que a Camada 1 inferiu.
 *
 * É a metade "corrige depois" da abordagem otimista: a inferência já
 * aconteceu, e aqui o usuário conserta tipo e nome de coluna. A confiança de
 * cada inferência é exibida justamente para dirigir a atenção ao que provavelmente
 * está errado (CLAUDE.md, seções 2.4 e 7.2).
 */

import { applyTypeOverrides } from "@/lib/parsing/schema-builder";
import type { ColumnType, ParsedWorkbook } from "@/lib/parsing/types";

const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  date: "Data",
  number: "Número",
  category: "Categoria",
  identifier: "Identificador",
  boolean: "Sim/Não",
  empty: "Vazia",
};

const COLUMN_TYPES = Object.keys(COLUMN_TYPE_LABELS) as ColumnType[];

/** Abaixo disso a inferência merece um olhar do usuário. */
const LOW_CONFIDENCE = 0.75;

interface SchemaReviewProps {
  workbook: ParsedWorkbook;
  onChange: (workbook: ParsedWorkbook) => void;
}

export function SchemaReview({ workbook, onChange }: SchemaReviewProps) {
  function updateTable(tableKey: string, updater: (index: number) => ParsedWorkbook["tables"][number]) {
    const index = workbook.tables.findIndex((table) => table.schema.key === tableKey);
    if (index < 0) return;
    const tables = workbook.tables.slice();
    tables[index] = updater(index);
    onChange({ ...workbook, tables });
  }

  function handleTypeChange(tableKey: string, columnKey: string, type: ColumnType) {
    updateTable(tableKey, (index) =>
      applyTypeOverrides(workbook.tables[index], { [columnKey]: type }),
    );
  }

  function handleLabelChange(tableKey: string, columnKey: string, label: string) {
    updateTable(tableKey, (index) => {
      const table = workbook.tables[index];
      return {
        ...table,
        schema: {
          ...table.schema,
          columns: table.schema.columns.map((column) =>
            column.key === columnKey ? { ...column, label } : column,
          ),
        },
      };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {workbook.tables.map((table) => (
        <div key={table.schema.key} className="rounded-lg border border-[#e1e0d9] bg-[#fcfcfb]">
          <div className="border-b border-[#e1e0d9] px-4 py-3">
            <h3 className="text-sm font-semibold text-[#0b0b0b]">{table.schema.label}</h3>
            <p className="text-xs text-[#898781]">
              {table.schema.rowCount} linhas · {table.schema.columns.length} colunas ·{" "}
              {table.schema.headerRowIndex === null
                ? "cabeçalho não identificado"
                : `cabeçalho na linha ${table.schema.headerRowIndex + 1}`}
            </p>
            {table.schema.warnings.map((warning) => (
              <p key={warning} className="mt-1 text-xs text-[#eb6834]">
                {warning}
              </p>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#e1e0d9] text-xs text-[#898781]">
                  <th className="px-4 py-2 font-medium">Coluna</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Exemplos</th>
                </tr>
              </thead>
              <tbody>
                {table.schema.columns.map((column) => (
                  <tr key={column.key} className="border-b border-[#e1e0d9] last:border-0">
                    <td className="px-4 py-2">
                      <input
                        value={column.label}
                        onChange={(event) =>
                          handleLabelChange(table.schema.key, column.key, event.target.value)
                        }
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[#0b0b0b] hover:border-[#e1e0d9] focus:border-[#2a78d6] focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={column.type}
                        onChange={(event) =>
                          handleTypeChange(
                            table.schema.key,
                            column.key,
                            event.target.value as ColumnType,
                          )
                        }
                        className="rounded border border-[#e1e0d9] bg-white px-2 py-1 text-xs text-[#0b0b0b]"
                      >
                        {COLUMN_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {COLUMN_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                      {column.confidence < LOW_CONFIDENCE ? (
                        <span className="ml-2 text-xs text-[#eb6834]">confira</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-xs text-[#52514e]">
                      {column.sampleValues.slice(0, 3).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
