"use client";

/**
 * O dashboard em si. É este bloco que sobra na página quando o usuário manda
 * imprimir — todo o resto da interface carrega `print:hidden`.
 */

import { ChartCard } from "@/components/charts/ChartCard";
import type { DashboardPayload } from "@/lib/dashboard/types";

interface DashboardViewProps {
  payload: DashboardPayload;
}

export function DashboardView({ payload }: DashboardViewProps) {
  const { config, workbook } = payload;
  const kpis = config.charts.filter((chart) => chart.type === "kpi");
  const rest = config.charts.filter((chart) => chart.type !== "kpi");

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-[#0b0b0b]">{config.title}</h1>
        <p className="text-sm text-[#898781]">{workbook.source.label}</p>
      </header>

      {config.charts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#c3c2b7] p-8 text-center text-sm text-[#52514e]">
          Nenhum gráfico no dashboard ainda.
        </p>
      ) : null}

      {kpis.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((chart) => (
            <ChartCard key={chart.id} spec={chart} workbook={workbook} />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rest.map((chart) => (
          <div key={chart.id} className={chart.type === "table" ? "lg:col-span-2" : undefined}>
            <ChartCard spec={chart} workbook={workbook} />
          </div>
        ))}
      </div>
    </section>
  );
}
