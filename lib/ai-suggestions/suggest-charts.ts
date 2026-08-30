/**
 * Camada 2 — sugestão semântica de gráficos via Claude.
 *
 * Este é o ÚNICO arquivo do projeto que fala com a API da Anthropic. Trocar
 * de provedor (ou remover a IA) significa mexer só aqui (CLAUDE.md, seção 4.2).
 *
 * Duas regras que não devem ser afrouxadas:
 *  - a entrada é o schema resumido, nunca as linhas da planilha;
 *  - qualquer falha degrada para a heurística determinística, nunca para erro.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { buildHeuristicCharts } from "@/lib/ai-suggestions/fallback-charts";
import type { ChartSpec, ChartType } from "@/lib/dashboard/types";
import type { SchemaSummary, SchemaSummaryTable } from "@/lib/parsing/schema-builder";

/**
 * Modelo mais barato disponível — exigência da seção 3 do CLAUDE.md. A tarefa
 * é classificação estruturada sobre um input pequeno, não exige raciocínio
 * profundo.
 */
const MODEL = "claude-haiku-4-5";

/** A saída é deliberadamente curta: no máximo 8 sugestões enxutas. */
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = [
  "Você é um especialista em visualização de dados que sugere gráficos para usuários leigos.",
  "Você recebe apenas o schema de uma planilha (nomes, tipos, cardinalidade e poucos exemplos de valores) — nunca os dados completos.",
  "Sugira de 3 a 6 visualizações que respondam às perguntas mais óbvias sobre esses dados.",
  "Regras:",
  "- Use apenas as chaves (key) de tabelas e colunas que aparecem no schema. Nunca invente chaves.",
  "- categoryKey deve ser uma coluna de tipo date, category ou boolean.",
  "- valueKeys deve conter apenas colunas de tipo number.",
  "- Para type 'kpi', use categoryKey null e exatamente uma coluna em valueKeys.",
  "- Prefira série temporal (line) quando houver coluna de data.",
  "- Use 'hbar' (barras deitadas) quando os rótulos da categoria forem longos: eles não cabem embaixo de uma barra em pé.",
  "- Evite colunas de tipo identifier: elas não agregam informação visual.",
  "- Títulos e justificativas em português do Brasil, curtos e sem jargão técnico.",
].join("\n");

const SuggestedChartSchema = z.object({
  type: z.enum(["bar", "hbar", "line", "area", "pie", "kpi", "table"]),
  title: z.string(),
  tableKey: z.string(),
  categoryKey: z.string().nullable(),
  valueKeys: z.array(z.string()),
  aggregation: z.enum(["sum", "avg", "count", "min", "max"]),
  rationale: z.string(),
});

const SuggestionResponseSchema = z.object({
  charts: z.array(SuggestedChartSchema),
});

type SuggestedChart = z.infer<typeof SuggestedChartSchema>;

export interface SuggestionResult {
  charts: ChartSpec[];
  provider: "ai" | "heuristic";
  /** Preenchido quando houve degradação para a heurística. */
  warning?: string;
}

const CATEGORY_TYPES = new Set(["date", "category", "boolean"]);

/**
 * Valida uma sugestão contra o schema real. O modelo pode alucinar chaves de
 * coluna, e um gráfico apontando para coluna inexistente quebraria o editor.
 */
function toChartSpec(
  suggestion: SuggestedChart,
  tables: Map<string, SchemaSummaryTable>,
  index: number,
): ChartSpec | null {
  const table = tables.get(suggestion.tableKey);
  if (!table) return null;

  const columns = new Map(table.columns.map((column) => [column.key, column]));
  const valueKeys = suggestion.valueKeys.filter((key) => columns.get(key)?.type === "number");

  const category = suggestion.categoryKey ? columns.get(suggestion.categoryKey) : undefined;
  const categoryKey = category && CATEGORY_TYPES.has(category.type) ? category.key : null;

  const type: ChartType = suggestion.type;
  if (type === "kpi") {
    if (valueKeys.length === 0) return null;
  } else if (type !== "table") {
    if (!categoryKey) return null;
    // Sem coluna numérica o gráfico ainda funciona: vira contagem de linhas.
  }

  return {
    id: `${suggestion.tableKey}-ai-${index}`,
    type,
    title: suggestion.title.trim() || "Gráfico",
    tableKey: suggestion.tableKey,
    categoryKey: type === "kpi" || type === "table" ? null : categoryKey,
    valueKeys: type === "kpi" ? valueKeys.slice(0, 1) : valueKeys,
    aggregation: valueKeys.length === 0 ? "count" : suggestion.aggregation,
    limit: type === "pie" ? 6 : type === "table" ? 20 : category?.type === "date" ? 60 : 12,
    granularity: category?.type === "date" ? "month" : undefined,
    rationale: suggestion.rationale.trim(),
    origin: "ai",
  };
}

/**
 * Recebe o schema resumido (Camada 1) e devolve sugestões de gráficos.
 * Nunca lança: falhas viram sugestões heurísticas com um aviso.
 */
export async function suggestCharts(summary: SchemaSummary): Promise<SuggestionResult> {
  const fallback = (warning: string): SuggestionResult => ({
    charts: buildHeuristicCharts(summary),
    provider: "heuristic",
    warning,
  });

  if (summary.tables.length === 0) {
    return { charts: [], provider: "heuristic" };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallback("ANTHROPIC_API_KEY não configurada — sugestões geradas por heurística.");
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Schema da planilha:\n\n${JSON.stringify(summary, null, 2)}`,
        },
      ],
      output_config: { format: zodOutputFormat(SuggestionResponseSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed) return fallback("A IA não retornou uma resposta válida — usando heurística.");

    const tables = new Map(summary.tables.map((table) => [table.key, table]));
    const charts = parsed.charts
      .map((suggestion, index) => toChartSpec(suggestion, tables, index))
      .filter((chart): chart is ChartSpec => chart !== null);

    if (charts.length === 0) {
      return fallback("As sugestões da IA não puderam ser aplicadas ao schema — usando heurística.");
    }
    return { charts, provider: "ai" };
  } catch (error) {
    console.error("[ai-suggestions] falha ao consultar a Claude API", error);
    return fallback("Não foi possível consultar a IA — sugestões geradas por heurística.");
  }
}
