"use client";

/**
 * Painel contextual do gráfico selecionado.
 *
 * Tudo aqui se aplica ao gráfico que está selecionado no canvas — o usuário
 * nunca abre um menu genérico para depois escolher a que gráfico a
 * configuração se aplica (CLAUDE.md, 11.3). Por isso o cabeçalho é o título do
 * próprio gráfico, e não um rótulo genérico: o painel diz de quem ele é.
 */

import { ChartThumbnail } from "@/components/charts/ChartThumbnail";
import { distinctCategoryValues } from "@/lib/dashboard/aggregate";
import {
  AGGREGATIONS,
  CHART_TYPES,
  canCompare,
  canStack,
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
  type ChartAxis,
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
  const outrosQuadros = workbook.tables.filter((item) => item.schema.key !== spec.tableKey);

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

  function alternarQuadroComparado(key: string) {
    const atuais = spec.compareTables ?? [];
    const proximos = atuais.includes(key)
      ? atuais.filter((item) => item !== key)
      : [...atuais, key];
    onChange({ ...spec, compareTables: proximos.length > 0 ? proximos : undefined });
  }

  function toggleValor(key: string) {
    const selecionadas = spec.valueKeys.includes(key)
      ? spec.valueKeys.filter((item) => item !== key)
      : [...spec.valueKeys, key];
    onChange({ ...spec, valueKeys: selecionadas });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="utilitaria text-osso-fraco">Gráfico selecionado</p>
            <h2 className="expandida mt-1 truncate text-base font-semibold text-osso">
              {spec.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-[3px] border border-borda px-2 py-1 text-xs text-osso-fraco transition-colors hover:border-alarme hover:text-alarme"
          >
            Remover
          </button>
        </div>
        <p className="mt-1.5 text-xs text-osso-fraco">
          O título é editado no próprio gráfico: clique nele e digite.
        </p>
      </div>

      <Campo rotulo="Formato">
        <div className="grid grid-cols-3 gap-1.5">
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

      {filterColumn && valoresDisponiveis.length > 1 ? (
        <Campo rotulo="Mostrar apenas">
          <label className={opcaoClass}>
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
            <div className="rolagem-bancada mt-1 flex max-h-44 flex-col gap-1 overflow-auto rounded-[3px] border border-borda p-2">
              {valoresDisponiveis.map((valor) => (
                <label key={valor} className={opcaoClass}>
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
              <label key={column.key} className={opcaoClass}>
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
                <span className="truncate">{column.label}</span>
              </label>
            ))}
          </div>
        )}
      </Campo>

      {canCompare(spec.type) ? (
        <details className="rounded-[3px] border border-borda px-3 py-2">
          <summary className="cursor-pointer text-xs text-osso-fraco transition-colors hover:text-osso">
            Comparar
          </summary>

          <div className="mt-3 flex flex-col gap-4">
            <Campo rotulo="No eixo">
              <select
                className={selectClass}
                value={spec.axis ?? "auto"}
                onChange={(event) =>
                  onChange({
                    ...spec,
                    axis: event.target.value === "auto" ? undefined : (event.target.value as ChartAxis),
                  })
                }
              >
                <option value="auto">Automático</option>
                <option value="rows">Uma barra por linha</option>
                <option value="columns">Uma barra por coluna</option>
              </select>
              <span className={dicaClass}>
                Trocar o eixo responde a outra pergunta com os mesmos números: comparar
                indicadores dentro de uma coluna, ou colunas dentro de um indicador.
              </span>
            </Campo>

            {outrosQuadros.length > 0 ? (
              <Campo rotulo="Comparar com outro quadro">
                <div className="flex max-h-40 flex-col gap-1 overflow-auto">
                  {outrosQuadros.map((item) => (
                    <label key={item.schema.key} className={opcaoClass}>
                      <input
                        type="checkbox"
                        checked={(spec.compareTables ?? []).includes(item.schema.key)}
                        onChange={() => alternarQuadroComparado(item.schema.key)}
                      />
                      <span className="truncate">{item.schema.label}</span>
                    </label>
                  ))}
                </div>
                <span className={dicaClass}>
                  Cada quadro vira uma série. As colunas são casadas pelo nome — “PAMC” de um
                  quadro com “PAMC” do outro.
                </span>
              </Campo>
            ) : null}

            {canStack(spec.type) ? (
              <label className="flex items-start gap-2 text-xs text-osso">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={spec.stacked ?? false}
                  onChange={(event) => onChange({ ...spec, stacked: event.target.checked })}
                />
                <span>
                  Empilhar as séries
                  <span className="mt-0.5 block text-[11px] leading-snug text-osso-fraco">
                    Uma barra só, dividida — mostra quanto cada parte é do todo, em vez de qual
                    é maior.
                  </span>
                </span>
              </label>
            ) : null}

            <label className="flex items-start gap-2 text-xs text-osso">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={spec.valueMode === "percent"}
                onChange={(event) =>
                  onChange({ ...spec, valueMode: event.target.checked ? "percent" : undefined })
                }
              />
              <span>
                Mostrar em porcentagem
                <span className="mt-0.5 block text-[11px] leading-snug text-osso-fraco">
                  Com uma coluna escolhida, cada barra vira a fatia dela no total do gráfico.
                  Com várias, cada série vira a fatia dela dentro da barra.
                </span>
              </span>
            </label>
          </div>
        </details>
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

      {/*
        O que segue quase nunca precisa ser mexido, e são justamente os dois
        controles que exigem saber o que é agregação. Ficam fechados para que a
        primeira leitura do painel tenha só as decisões que o usuário entende.
      */}
      {spec.valueKeys.length > 0 || needsCategory(spec.type) ? (
        <details className="rounded-[3px] border border-borda px-3 py-2">
          <summary className="cursor-pointer text-xs text-osso-fraco transition-colors hover:text-osso">
            Mais opções
          </summary>

          <div className="mt-3 flex flex-col gap-4">
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
              <label className="flex items-start gap-2 text-xs text-osso">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={spec.includeTotalRows ?? false}
                  onChange={(event) =>
                    onChange({ ...spec, includeTotalRows: event.target.checked })
                  }
                />
                <span>
                  Incluir linhas de total
                  <span className="mt-0.5 block text-[11px] leading-snug text-osso-fraco">
                    Linhas como “Subtotal” ficam de fora, senão achatam as demais barras.
                  </span>
                </span>
              </label>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

const selectClass =
  "w-full rounded-[3px] border border-borda bg-bancada px-2 py-1.5 text-xs text-osso transition-colors hover:border-borda-forte";

const opcaoClass = "flex items-center gap-2 text-xs text-osso";

const avisoClass = "text-xs leading-relaxed text-osso-fraco";

const dicaClass = "text-[11px] leading-snug text-osso-fraco";

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="utilitaria text-osso-fraco">{rotulo}</span>
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
      className={`flex flex-col items-center gap-1 rounded-[3px] border p-2 text-[10px] transition-colors ${
        ativo
          ? "border-osso bg-bancada text-osso"
          : "border-borda text-osso-fraco hover:border-borda-forte hover:text-osso"
      }`}
    >
      <ChartThumbnail type={type} color={color} className="h-7 w-10" />
      {CHART_TYPE_LABELS[type]}
    </button>
  );
}
