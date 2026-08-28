"use client";

/**
 * Painel contextual do gráfico selecionado.
 *
 * Tudo aqui se aplica ao gráfico que está selecionado no canvas — o usuário
 * nunca abre um menu genérico para depois escolher a que gráfico a
 * configuração se aplica (CLAUDE.md, 11.3).
 */

import { ChartThumbnail } from "@/components/charts/ChartThumbnail";
import { distinctCategoryValues } from "@/lib/dashboard/aggregate";
import {
  AGGREGATIONS,
  CHART_TYPES,
  categoryColumns,
  needsCategory,
  numberColumns,
} from "@/lib/dashboard/chart-spec";
import { colorAt, type Palette } from "@/lib/dashboard/palettes";
import {
  AGGREGATION_LABELS,
  CHART_TYPE_HINTS,
  CHART_TYPE_LABELS,
  type Aggregation,
  type ChartSpec,
  type ChartType,
} from "@/lib/dashboard/types";
import type { ParsedWorkbook } from "@/lib/parsing/types";

interface ChartInspectorProps {
  spec: ChartSpec;
  workbook: ParsedWorkbook;
  palette: Palette;
  /** Folha em que este gráfico está, a partir de 0. */
  page: number;
  /** Quantas folhas o dashboard tem. */
  pageCount: number;
  onChange: (spec: ChartSpec) => void;
  onMoveToPage: (page: number) => void;
  onRemove: () => void;
}

export function ChartInspector({
  spec,
  workbook,
  palette,
  page,
  pageCount,
  onChange,
  onMoveToPage,
  onRemove,
}: ChartInspectorProps) {
  const table = workbook.tables.find((item) => item.schema.key === spec.tableKey);
  const categorias = categoryColumns(table);
  const numeros = numberColumns(table);

  /**
   * A coluna do recorte é a de agrupamento quando existe; em KPI e tabela, que
   * não têm eixo, cai na primeira coluna de texto do quadro — que nesses
   * relatórios é justamente a dos indicadores.
   */
  const filterColumn = spec.filter?.columnKey ?? spec.categoryKey ?? categorias[0]?.key ?? null;
  const valoresDisponiveis =
    table && filterColumn ? distinctCategoryValues(table, filterColumn) : [];
  const selecionados = new Set(spec.filter?.values ?? []);
  const mostrarTodos = selecionados.size === 0;

  function alternarValor(valor: string) {
    if (!filterColumn) return;
    const proximos = new Set(selecionados);
    if (proximos.has(valor)) proximos.delete(valor);
    else proximos.add(valor);

    // Sem nenhum marcado o gráfico ficaria vazio sem explicação: volta a "todos".
    const values = [...proximos];
    onChange({
      ...spec,
      filter: values.length === 0 ? undefined : { columnKey: filterColumn, values },
    });
  }

  function toggleValor(key: string) {
    const selecionadas = spec.valueKeys.includes(key)
      ? spec.valueKeys.filter((item) => item !== key)
      : [...spec.valueKeys, key];
    onChange({ ...spec, valueKeys: selecionadas });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#0b0b0b]">Gráfico selecionado</h2>
        <button
          type="button"
          onClick={onRemove}
          className="rounded border border-[#e1e0d9] px-2 py-1 text-xs text-[#52514e] hover:border-[#e34948] hover:text-[#e34948] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
        >
          Remover
        </button>
      </div>

      <Campo rotulo="Formato">
        <div className="grid grid-cols-3 gap-2">
          {CHART_TYPES.map((type) => (
            <BotaoFormato
              key={type}
              type={type}
              color={colorAt(palette, 0)}
              ativo={spec.type === type}
              onClick={() => onChange({ ...spec, type })}
            />
          ))}
        </div>
      </Campo>

      {workbook.tables.length > 1 ? (
        <Campo rotulo="Quadro">
          <select
            className={selectClass}
            value={spec.tableKey}
            onChange={(event) =>
              // Trocar de quadro invalida colunas e recorte escolhidos.
              onChange({
                ...spec,
                tableKey: event.target.value,
                categoryKey: null,
                valueKeys: [],
                filter: undefined,
              })
            }
          >
            {workbook.tables.map((item) => (
              <option key={item.schema.key} value={item.schema.key}>
                {item.schema.label}
              </option>
            ))}
          </select>
        </Campo>
      ) : null}

      {filterColumn ? (
        <Campo rotulo="Mostrar apenas">
          <label className="flex items-center gap-2 text-xs text-[#52514e]">
            <input
              type="checkbox"
              checked={mostrarTodos}
              onChange={(event) =>
                onChange({
                  ...spec,
                  filter: event.target.checked
                    ? undefined
                    : { columnKey: filterColumn, values: valoresDisponiveis.slice(0, 1) },
                })
              }
            />
            Todos ({valoresDisponiveis.length})
          </label>

          {!mostrarTodos ? (
            <div className="mt-1 flex max-h-44 flex-col gap-1 overflow-auto rounded border border-[#e1e0d9] p-2">
              {valoresDisponiveis.map((valor) => (
                <label key={valor} className="flex items-center gap-2 text-xs text-[#52514e]">
                  <input
                    type="checkbox"
                    checked={selecionados.has(valor)}
                    onChange={() => alternarValor(valor)}
                  />
                  <span className="truncate">{valor}</span>
                </label>
              ))}
            </div>
          ) : null}
        </Campo>
      ) : null}

      {needsCategory(spec.type) ? (
        <Campo rotulo="Agrupar por">
          {categorias.length === 0 ? (
            <p className={avisoClass}>
              Este quadro não tem colunas de data ou de texto para agrupar. Escolha outro quadro
              ou o formato “Número”.
            </p>
          ) : (
            <select
              className={selectClass}
              value={spec.categoryKey ?? ""}
              onChange={(event) => onChange({ ...spec, categoryKey: event.target.value || null })}
            >
              {categorias.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
          )}
        </Campo>
      ) : null}

      <Campo rotulo={spec.type === "kpi" ? "Coluna do número" : "Colunas com os valores"}>
        {numeros.length === 0 ? (
          <p className={avisoClass}>
            Este quadro não tem colunas numéricas. O gráfico vai contar quantas linhas há em
            cada grupo.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {numeros.map((column) => (
              <label
                key={column.key}
                className="flex items-center gap-2 text-xs text-[#52514e]"
              >
                <input
                  type={spec.type === "kpi" ? "radio" : "checkbox"}
                  name={spec.type === "kpi" ? `valor-${spec.id}` : undefined}
                  checked={spec.valueKeys.includes(column.key)}
                  onChange={() =>
                    spec.type === "kpi"
                      ? onChange({ ...spec, valueKeys: [column.key] })
                      : toggleValor(column.key)
                  }
                />
                {column.label}
              </label>
            ))}
          </div>
        )}
      </Campo>

      {spec.valueKeys.length > 0 ? (
        <Campo rotulo="Cálculo">
          <select
            className={selectClass}
            value={spec.aggregation}
            onChange={(event) =>
              onChange({ ...spec, aggregation: event.target.value as Aggregation })
            }
          >
            {AGGREGATIONS.map((aggregation) => (
              <option key={aggregation} value={aggregation}>
                {AGGREGATION_LABELS[aggregation]}
              </option>
            ))}
          </select>
        </Campo>
      ) : null}

      {needsCategory(spec.type) ? (
        <label className="flex items-start gap-2 text-xs text-[#52514e]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={spec.includeTotalRows ?? false}
            onChange={(event) => onChange({ ...spec, includeTotalRows: event.target.checked })}
          />
          <span>
            Incluir linhas de total
            <span className="block text-[11px] text-[#898781]">
              Linhas como “Subtotal” ficam de fora, senão achatam as demais barras.
            </span>
          </span>
        </label>
      ) : null}

      <Campo rotulo="Página">
        <select
          className={selectClass}
          value={page}
          onChange={(event) => onMoveToPage(Number(event.target.value))}
        >
          {Array.from({ length: pageCount }, (_, indice) => (
            <option key={indice} value={indice}>
              Página {indice + 1}
            </option>
          ))}
          {/* Abrir folha nova é uma opção da mesma lista: é assim que o
              dashboard cresce além do que cabe numa página. */}
          <option value={pageCount}>Nova página ({pageCount + 1})</option>
        </select>
      </Campo>

      <p className="text-xs text-[#898781]">
        O título é editado no próprio gráfico: clique nele e digite.
      </p>
    </div>
  );
}

const selectClass =
  "w-full rounded border border-[#e1e0d9] bg-white px-2 py-1.5 text-xs text-[#0b0b0b] focus:border-[#2a78d6] focus:outline-none";

const avisoClass = "text-xs text-[#52514e]";

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[#898781]">{rotulo}</span>
      {children}
    </div>
  );
}

function BotaoFormato({
  type,
  color,
  ativo,
  onClick,
}: {
  type: ChartType;
  color: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      title={CHART_TYPE_HINTS[type]}
      className={`flex flex-col items-center gap-1 rounded-md border p-2 text-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6] ${
        ativo
          ? "border-[#2a78d6] bg-[#eef4fd] text-[#0b0b0b]"
          : "border-[#e1e0d9] text-[#52514e] hover:border-[#c3c2b7]"
      }`}
    >
      <ChartThumbnail type={type} color={color} className="h-7 w-10" />
      {CHART_TYPE_LABELS[type]}
    </button>
  );
}
