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
  onAddSuggestion: (spec: ChartSpec) => void;
  onCreateBlank: () => void;
}

export function AddChartPanel({
  suggestions,
  palette,
  onAddSuggestion,
  onCreateBlank,
}: AddChartPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="expandida text-base font-semibold text-osso">Adicionar um gráfico</h2>
        <p className="mt-1 text-xs leading-relaxed text-osso-fraco">
          Quando a folha enche, o gráfico novo abre a página seguinte.
        </p>
      </div>

      {/*
        O estado de repouso do painel é onde o usuário perdido olha primeiro,
        então é aqui que os três gestos da folha são ensinados — sem tutorial,
        sem modal de boas-vindas (CLAUDE.md, 11.9: estados vazios convidam à ação).
      */}
      <ul className="flex flex-col gap-2 border-l border-borda pl-3 text-xs leading-snug text-osso-fraco">
        <li>Clique em um gráfico para editá-lo.</li>
        <li>Arraste para mudar de lugar.</li>
        <li>Puxe o canto de baixo à direita para redimensionar.</li>
      </ul>

      {suggestions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="utilitaria text-osso-fraco">Sugestões para esta planilha</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => onAddSuggestion(suggestion)}
              className="flex items-start gap-3 rounded-[3px] border border-borda p-2 text-left transition-colors hover:border-borda-forte hover:bg-bancada"
            >
              <ChartThumbnail
                type={suggestion.type}
                color={colorAt(palette, 0)}
                className="mt-0.5 h-7 w-10 shrink-0"
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-osso">
                  {suggestion.title}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-osso-fraco">
                  {suggestion.rationale || CHART_TYPE_HINTS[suggestion.type]}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-osso-fraco">
          Todas as sugestões automáticas já estão na folha.
        </p>
      )}

      <button
        type="button"
        onClick={onCreateBlank}
        className="rounded-[3px] border border-borda-forte px-3 py-2 text-xs text-osso transition-colors hover:bg-bancada"
      >
        Montar um gráfico escolhendo as colunas
      </button>
    </div>
  );
}
