"use client";

/**
 * Edição de um gráfico sugerido.
 *
 * Os seletores só oferecem colunas compatíveis com cada papel (categoria x
 * valor), o que impede o usuário leigo de montar um gráfico inválido sem
 * precisar de mensagens de erro.
 */

import {
  AGGREGATION_LABELS,
  CHART_TYPE_LABELS,
  type Aggregation,
  type ChartSpec,
  type ChartType,
} from "@/lib/dashboard/types";
import type { ParsedWorkbook } from "@/lib/parsing/types";

const CHART_TYPES = Object.keys(CHART_TYPE_LABELS) as ChartType[];
const AGGREGATIONS = Object.keys(AGGREGATION_LABELS) as Aggregation[];

/** Colunas que fazem sentido como eixo de agrupamento. */
const CATEGORY_TYPES = new Set(["date", "category", "boolean"]);

interface ChartEditorProps {
  spec: ChartSpec;
  workbook: ParsedWorkbook;
  onChange: (spec: ChartSpec) => void;
  onRemove: () => void;
}

export function ChartEditor({ spec, workbook, onChange, onRemove }: ChartEditorProps) {
  const table = workbook.tables.find((item) => item.schema.key === spec.tableKey);
  const columns = table?.schema.columns ?? [];
  const categoryColumns = columns.filter((column) => CATEGORY_TYPES.has(column.type));
  const numberColumns = columns.filter((column) => column.type === "number");

  const needsCategory = spec.type !== "kpi" && spec.type !== "table";

  function toggleValueKey(key: string) {
    const selected = spec.valueKeys.includes(key)
      ? spec.valueKeys.filter((item) => item !== key)
      : [...spec.valueKeys, key];
    // KPI representa um único número.
    onChange({ ...spec, valueKeys: spec.type === "kpi" ? selected.slice(-1) : selected });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#e1e0d9] bg-[#fcfcfb] p-4">
      <div className="flex items-start gap-2">
        <input
          value={spec.title}
          onChange={(event) => onChange({ ...spec, title: event.target.value })}
          className="flex-1 rounded border border-[#e1e0d9] px-2 py-1 text-sm font-medium text-[#0b0b0b] focus:border-[#2a78d6] focus:outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          className="rounded border border-[#e1e0d9] px-2 py-1 text-xs text-[#52514e] hover:border-[#e34948] hover:text-[#e34948]"
        >
          Remover
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Tipo">
          <select
            value={spec.type}
            onChange={(event) => onChange({ ...spec, type: event.target.value as ChartType })}
            className={selectClass}
          >
            {CHART_TYPES.map((type) => (
              <option key={type} value={type}>
                {CHART_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Aba">
          <select
            value={spec.tableKey}
            onChange={(event) =>
              // Trocar de aba invalida as colunas escolhidas.
              onChange({
                ...spec,
                tableKey: event.target.value,
                categoryKey: null,
                valueKeys: [],
              })
            }
            className={selectClass}
          >
            {workbook.tables.map((item) => (
              <option key={item.schema.key} value={item.schema.key}>
                {item.schema.label}
              </option>
            ))}
          </select>
        </Field>

        {needsCategory ? (
          <Field label="Agrupar por">
            <select
              value={spec.categoryKey ?? ""}
              onChange={(event) =>
                onChange({ ...spec, categoryKey: event.target.value || null })
              }
              className={selectClass}
            >
              <option value="">Selecione…</option>
              {categoryColumns.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Cálculo">
          <select
            value={spec.aggregation}
            onChange={(event) =>
              onChange({ ...spec, aggregation: event.target.value as Aggregation })
            }
            className={selectClass}
          >
            {AGGREGATIONS.map((aggregation) => (
              <option key={aggregation} value={aggregation}>
                {AGGREGATION_LABELS[aggregation]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-[#898781]">
          {spec.type === "kpi" ? "Coluna do indicador" : "Colunas de valor"}
        </legend>
        {numberColumns.length === 0 ? (
          <p className="mt-1 text-xs text-[#52514e]">
            Esta aba não tem colunas numéricas; o gráfico contará linhas.
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {numberColumns.map((column) => (
              <label key={column.key} className="flex items-center gap-1.5 text-xs text-[#52514e]">
                <input
                  type="checkbox"
                  checked={spec.valueKeys.includes(column.key)}
                  onChange={() => toggleValueKey(column.key)}
                />
                {column.label}
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}

const selectClass =
  "w-full rounded border border-[#e1e0d9] bg-white px-2 py-1 text-xs text-[#0b0b0b] focus:border-[#2a78d6] focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[#898781]">{label}</span>
      {children}
    </label>
  );
}
