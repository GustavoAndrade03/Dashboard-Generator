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
    <div className="flex flex-col gap-5">
      {workbook.tables.map((table) => (
        <div key={table.schema.key} className="rounded-[3px] border border-borda">
          <div className="border-b border-borda px-4 py-3">
            <h3 className="expandida text-sm font-semibold text-osso">{table.schema.label}</h3>
            {/* Contagem e posição do cabeçalho são o que a máquina leu, não o
                que a interface diz — daí o registro utilitário. */}
            <p className="utilitaria mt-1 text-osso-fraco">
              {table.schema.rowCount} linhas · {table.schema.columns.length} colunas ·{" "}
              {table.schema.headerRowIndex === null
                ? "cabeçalho não identificado"
                : `cabeçalho na linha ${table.schema.headerRowIndex + 1}`}
            </p>
            {table.schema.warnings.map((warning) => (
              <p key={warning} className="mt-1.5 text-xs text-alarme">
                {warning}
              </p>
            ))}
          </div>

          <div className="rolagem-bancada overflow-x-auto">
            <table className="w-full max-w-4xl text-left text-sm">
              <thead>
                <tr className="border-b border-borda">
                  <th className="utilitaria px-4 py-2 text-left font-normal text-osso-fraco">
                    Coluna
                  </th>
                  <th className="utilitaria px-4 py-2 text-left font-normal text-osso-fraco">
                    Tipo
                  </th>
                  <th className="utilitaria px-4 py-2 text-left font-normal text-osso-fraco">
                    Exemplos
                  </th>
                </tr>
              </thead>
              <tbody>
                {table.schema.columns.map((column) => (
                  <tr key={column.key} className="border-b border-borda last:border-0">
                    <td className="px-4 py-2">
                      <input
                        value={column.label}
                        aria-label={`Nome da coluna ${column.label}`}
                        onChange={(event) =>
                          handleLabelChange(table.schema.key, column.key, event.target.value)
                        }
                        className="w-full rounded-[3px] border border-transparent bg-transparent px-1 py-0.5 text-sm text-osso hover:border-borda focus:border-osso-fraco focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={column.type}
                        aria-label={`Tipo da coluna ${column.label}`}
                        onChange={(event) =>
                          handleTypeChange(
                            table.schema.key,
                            column.key,
                            event.target.value as ColumnType,
                          )
                        }
                        className="rounded-[3px] border border-borda bg-bancada px-2 py-1 text-xs text-osso transition-colors hover:border-borda-forte"
                      >
                        {COLUMN_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {COLUMN_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                      {column.confidence < LOW_CONFIDENCE ? (
                        <span className="utilitaria ml-2 text-alarme">confira</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-osso-fraco">
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
