"use client";

/**
 * Edição dos valores que vieram da planilha.
 *
 * Corrigir um número no arquivo original e reenviar é justamente o trabalho
 * que a ferramenta existe para evitar. Editar aqui atualiza os gráficos na
 * hora, e cada alteração é um passo do histórico — dá para desfazer.
 *
 * O valor digitado passa pelo mesmo `coerceValue` da Camada 1, então "1.234,50"
 * numa coluna numérica vira 1234.5, do mesmo jeito que viria da planilha.
 *
 * A tabela fica na bancada, e não em branco: branco na tela é o que vai para o
 * PDF, e estas células não vão. Os números saem em mono, alinhados à direita —
 * é a coluna que o usuário confere de cima a baixo procurando o valor errado.
 */

import { useState } from "react";

import { coerceValue } from "@/lib/parsing/infer-types";
import { refreshTableStats } from "@/lib/parsing/schema-builder";
import type { CellValue, ParsedTable, ParsedWorkbook } from "@/lib/parsing/types";

/** Editar planilhas enormes célula a célula não é o caso de uso; o resto fica visível na revisão. */
const MAX_VISIBLE_ROWS = 100;

interface DataEditorProps {
  workbook: ParsedWorkbook;
  onChange: (workbook: ParsedWorkbook) => void;
}

export function DataEditor({ workbook, onChange }: DataEditorProps) {
  const [tableKey, setTableKey] = useState(workbook.tables[0]?.schema.key ?? "");
  const table =
    workbook.tables.find((item) => item.schema.key === tableKey) ?? workbook.tables[0];

  if (!table) return <p className="text-xs text-osso-fraco">Nenhuma tabela para editar.</p>;

  function replaceTable(next: ParsedTable) {
    onChange({
      ...workbook,
      tables: workbook.tables.map((item) =>
        item.schema.key === next.schema.key ? refreshTableStats(next) : item,
      ),
    });
  }

  function editCell(rowIndex: number, columnIndex: number, raw: string) {
    const column = table.schema.columns[columnIndex];
    const valor = coerceValue(raw.trim() === "" ? null : raw, column.type);
    const rows = table.rows.map((row, index) =>
      index === rowIndex ? row.map((cell, col) => (col === columnIndex ? valor : cell)) : row,
    );
    replaceTable({ ...table, rows });
  }

  function removeRow(rowIndex: number) {
    replaceTable({ ...table, rows: table.rows.filter((_, index) => index !== rowIndex) });
  }

  function addRow() {
    const vazia: CellValue[] = table.schema.columns.map(() => null);
    replaceTable({ ...table, rows: [...table.rows, vazia] });
  }

  const visiveis = table.rows.slice(0, MAX_VISIBLE_ROWS);

  return (
    <div className="flex flex-col gap-3">
      {workbook.tables.length > 1 ? (
        <label className="flex flex-col gap-1.5">
          <span className="utilitaria text-osso-fraco">Quadro</span>
          <select
            value={table.schema.key}
            onChange={(event) => setTableKey(event.target.value)}
            className="w-full max-w-md rounded-[3px] border border-borda bg-bancada px-2 py-1.5 text-xs text-osso transition-colors hover:border-borda-forte"
          >
            {workbook.tables.map((item) => (
              <option key={item.schema.key} value={item.schema.key}>
                {item.schema.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="rolagem-bancada max-h-96 overflow-auto rounded-[3px] border border-borda">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-bancada">
            <tr>
              {table.schema.columns.map((column) => (
                <th
                  key={column.key}
                  className="utilitaria border-b border-borda px-2 py-2 text-left font-normal text-osso-fraco"
                >
                  {column.label}
                </th>
              ))}
              <th className="border-b border-borda px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-borda last:border-0">
                {row.map((cell, columnIndex) => (
                  <td key={columnIndex} className="p-0">
                    <EditableCell
                      value={cell}
                      numeric={table.schema.columns[columnIndex]?.type === "number"}
                      label={`${table.schema.columns[columnIndex]?.label}, linha ${rowIndex + 1}`}
                      onCommit={(raw) => editCell(rowIndex, columnIndex, raw)}
                    />
                  </td>
                ))}
                <td className="px-1">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    aria-label={`Remover linha ${rowIndex + 1}`}
                    className="rounded-[3px] px-1.5 py-0.5 text-osso-fraco transition-colors hover:text-alarme"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={addRow}
          className="rounded-[3px] border border-borda px-3 py-1.5 text-xs text-osso-fraco transition-colors hover:border-borda-forte hover:text-osso"
        >
          Adicionar linha
        </button>
        <p className="text-xs text-osso-fraco">
          {table.rows.length > MAX_VISIBLE_ROWS
            ? `Mostrando as primeiras ${MAX_VISIBLE_ROWS} de ${table.rows.length} linhas.`
            : `${table.rows.length} linhas. As alterações valem para os gráficos e para o PDF.`}
        </p>
      </div>
    </div>
  );
}

interface EditableCellProps {
  value: CellValue;
  numeric: boolean;
  label: string;
  onCommit: (raw: string) => void;
}

/**
 * O texto em edição fica num rascunho local e só é convertido ao sair do
 * campo. Converter a cada tecla atrapalharia: digitar "1.2" viraria "1"
 * antes de o usuário chegar no segundo dígito.
 */
function EditableCell({ value, numeric, label, onCommit }: EditableCellProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const exibido = draft ?? (value === null ? "" : String(value));

  return (
    <input
      value={exibido}
      aria-label={label}
      inputMode={numeric ? "decimal" : "text"}
      className={`w-full min-w-24 border border-transparent bg-transparent px-2 py-1 text-osso focus:border-osso-fraco focus:outline-none ${
        numeric ? "text-right font-mono tabular-nums" : ""
      }`}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== null) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setDraft(null);
      }}
    />
  );
}
