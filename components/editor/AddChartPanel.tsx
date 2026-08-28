"use client";

/**
 * Painel de adicionar gráfico.
 *
 * Mostra primeiro as sugestões que sobraram da análise automática, como
 * opções prontas com miniatura e justificativa. Montar do zero vem depois —
 * é o caminho mais trabalhoso, então não deve ser o mais visível
 * (CLAUDE.md, 11.4).
 */

import { ChartThumbnail } from "@/components/charts/ChartThumbnail";
import { colorAt, type Palette } from "@/lib/dashboard/palettes";
import { CHART_TYPE_HINTS, type ChartSpec } from "@/lib/dashboard/types";

interface AddChartPanelProps {
  suggestions: ChartSpec[];
  palette: Palette;
  /** false quando a folha está cheia: a página é uma só. */
  hasRoom: boolean;
  onAddSuggestion: (spec: ChartSpec) => void;
  onCreateBlank: () => void;
}

export function AddChartPanel({
  suggestions,
  palette,
  hasRoom,
  onAddSuggestion,
  onCreateBlank,
}: AddChartPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-[#0b0b0b]">Adicionar um gráfico</h2>
        <p className="mt-1 text-xs text-[#52514e]">
          Clique em um gráfico da folha para editá-lo.
        </p>
      </div>

      {!hasRoom ? (
        <p className="rounded-md border border-[#eda100] bg-white px-3 py-2 text-xs text-[#52514e]">
          A folha está cheia. Remova ou diminua um gráfico para abrir espaço.
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-[#898781]">Sugestões para esta planilha</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              disabled={!hasRoom}
              onClick={() => onAddSuggestion(suggestion)}
              className="flex items-start gap-3 rounded-md border border-[#e1e0d9] p-2 text-left hover:border-[#2a78d6] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
            >
              <ChartThumbnail
                type={suggestion.type}
                color={colorAt(palette, 0)}
                className="mt-0.5 h-7 w-10 shrink-0"
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-[#0b0b0b]">
                  {suggestion.title}
                </span>
                <span className="block text-[11px] text-[#898781]">
                  {suggestion.rationale || CHART_TYPE_HINTS[suggestion.type]}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#52514e]">
          Todas as sugestões automáticas já estão na folha.
        </p>
      )}

      <button
        type="button"
        disabled={!hasRoom}
        onClick={onCreateBlank}
        className="rounded-md border border-[#e1e0d9] px-3 py-2 text-xs text-[#52514e] hover:border-[#2a78d6] hover:text-[#2a78d6] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
      >
        Montar um gráfico escolhendo as colunas
      </button>
    </div>
  );
}
