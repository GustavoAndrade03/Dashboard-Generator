"use client";

/**
 * Renderiza um ChartSpec. O mesmo componente serve a tela e a impressão: o PDF
 * é a própria página impressa pelo navegador, então não existe uma segunda
 * implementação para divergir da primeira (CLAUDE.md, 11.1).
 *
 * O cartão preenche a altura da célula que recebe na grade — quem manda no
 * tamanho é o layout, não o gráfico.
 *
 * Animações ficam desligadas de propósito: a impressão captura a página em um
 * instante, e uma animação em curso viraria um gráfico pela metade.
 */

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { buildChartData } from "@/lib/dashboard/aggregate";
import { colorAt, type Palette } from "@/lib/dashboard/palettes";
import {
  formatCompact,
  formatNumber,
  formatPercent,
  labelInkOn,
} from "@/lib/dashboard/theme";
import type { SheetTheme } from "@/lib/dashboard/themes";
import type { ChartSpec } from "@/lib/dashboard/types";
import type { ParsedWorkbook } from "@/lib/parsing/types";

/*
 * Rótulo do eixo de categorias.
 *
 * O Recharts, por padrão, **esconde** o rótulo que não cabe (`interval` é
 * "preserveEnd"), e era isso que deixava barras sem nome nenhum. Aqui nenhum
 * rótulo some: ou ele cabe em pé, ou o eixo inclina 45°, o que multiplica por
 * ~1,4 o texto que cabe no mesmo espaço horizontal.
 *
 * A truncagem trabalha por orçamento em pixels, e não por contagem de
 * caracteres, porque a diferença é grande: medido no navegador a 11px, um
 * glifo maiúsculo ocupa 6,6px contra 5,2 de um minúsculo. Cortar por número de
 * caracteres estoura em rótulo TODO MAIÚSCULO — que é a forma dos relatórios
 * que o produto lê.
 */

/** Largura estimada de um glifo a 11px, por classe. Arredondada para cima. */
const GLIFO_MAIUSCULO = 7;
const GLIFO_MINUSCULO = 5;
const GLIFO_ESTREITO = 3.2;

const ESTREITOS = new Set([" ", ".", ",", ":", ";", "'", "!", "|", "(", ")", "/"]);

function larguraDoTexto(texto: string): number {
  let largura = 0;
  for (const ch of texto) {
    if (ESTREITOS.has(ch)) largura += GLIFO_ESTREITO;
    else if (ch !== ch.toLowerCase()) largura += GLIFO_MAIUSCULO;
    else largura += GLIFO_MINUSCULO;
  }
  return largura;
}

/** Corta o texto até caber no orçamento, reservando espaço para as reticências. */
function encurtaAte(value: unknown, orcamento: number): string {
  const texto = String(value ?? "");
  if (larguraDoTexto(texto) <= orcamento) return texto;

  const disponivel = orcamento - GLIFO_MINUSCULO;
  let largura = 0;
  let corte = 0;
  for (const ch of texto) {
    const proxima = largura + (ESTREITOS.has(ch) ? GLIFO_ESTREITO : ch !== ch.toLowerCase() ? GLIFO_MAIUSCULO : GLIFO_MINUSCULO);
    if (proxima > disponivel) break;
    largura = proxima;
    corte++;
  }
  return corte === 0 ? "" : `${texto.slice(0, corte).trimEnd()}…`;
}

/** cos(45°): quanto de um rótulo inclinado cabe na horizontal e na vertical. */
const COS45 = 0.7071;

/** Abaixo disto por categoria não cabe, em pé, rótulo que se leia. */
const ORCAMENTO_MINIMO_EM_PE = 46;

/** O que o cartão perde para o próprio padding, o título e o eixo de valores. */
const PADDING_DO_CARTAO = 24;
const LARGURA_DO_EIXO_Y = 48;
const ALTURA_DO_TITULO = 30;

/** Na barra deitada o rótulo fica na lateral, onde cabe muito mais texto. */
const SIDE_AXIS_WIDTH = 110;

const shortenSideTick = (value: unknown) => encurtaAte(value, SIDE_AXIS_WIDTH - 12);

function limita(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

/** Como desenhar o eixo das categorias neste cartão. */
function planoDoEixo(size: { width: number; height: number }, categorias: number) {
  const larguraUtil = Math.max(80, size.width - PADDING_DO_CARTAO - LARGURA_DO_EIXO_Y);
  const porCategoria = larguraUtil / Math.max(1, categorias) - 4;

  if (porCategoria >= ORCAMENTO_MINIMO_EM_PE) {
    return { inclinado: false, altura: 30, orcamento: porCategoria };
  }

  // Inclinado, quem manda é a altura: o rótulo desce na diagonal, e comer a
  // área de plotagem inteira seria trocar um defeito por outro.
  const alturaUtil = Math.max(60, size.height - PADDING_DO_CARTAO - ALTURA_DO_TITULO);
  const altura = limita(Math.round(alturaUtil * 0.4), 40, 72);
  // A reserva cobre o afastamento do tick e as descidas da fonte. Com menos, o
  // rótulo inclinado vazava um par de pixels para fora do cartão — medido.
  return { inclinado: true, altura, orcamento: (altura - 18) / COS45 };
}

function axisPropsFor(theme: SheetTheme) {
  return {
    stroke: theme.ink.baseline,
    tick: { fill: theme.ink.muted, fontSize: 11 },
    tickLine: false,
  } as const;
}

interface ChartCardProps {
  spec: ChartSpec;
  workbook: ParsedWorkbook;
  palette: Palette;
  /** Papel e tinta da folha — o Recharts precisa dos valores, não das variáveis CSS. */
  theme: SheetTheme;
  /** Tamanho do cartão em pixels, vindo da grade. Decide como o eixo é desenhado. */
  size: { width: number; height: number };
  /** Quando presente, o título vira editável no próprio cartão. */
  onTitleChange?: (title: string) => void;
}

export function ChartCard({
  spec,
  workbook,
  palette,
  theme,
  size,
  onTitleChange,
}: ChartCardProps) {
  const data = useMemo(() => buildChartData(workbook, spec), [workbook, spec]);

  return (
    <figure className="flex h-full flex-col overflow-hidden rounded-[6px] border border-gridline bg-surface p-3">
      <figcaption className="mb-2 shrink-0">
        {onTitleChange ? (
          <input
            // rgl-no-drag: sem isto, clicar para editar iniciaria um arrasto.
            className="rgl-no-drag expandida w-full truncate rounded-[3px] border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-ink hover:border-gridline focus:border-ink focus:outline-none"
            value={spec.title}
            aria-label="Título do gráfico"
            onChange={(event) => onTitleChange(event.target.value)}
          />
        ) : (
          <h3 className="expandida truncate px-1 text-sm font-semibold text-ink">{spec.title}</h3>
        )}
      </figcaption>

      <div className="min-h-0 flex-1">
        {data.error ? (
          <p className="px-1 text-xs text-ink-2">{data.error}</p>
        ) : (
          <ChartBody spec={spec} data={data} palette={palette} theme={theme} size={size} />
        )}
      </div>
    </figure>
  );
}

type ChartData = ReturnType<typeof buildChartData>;

interface BodyProps {
  spec: ChartSpec;
  data: ChartData;
  palette: Palette;
  theme: SheetTheme;
  size: { width: number; height: number };
}

function ChartBody({ spec, data, palette, theme, size }: BodyProps) {
  const axisProps = axisPropsFor(theme);
  if (spec.type === "kpi") {
    return (
      <div className="flex h-full flex-col justify-center px-1">
        <p className="expandida truncate text-3xl font-semibold tabular-nums text-ink">
          {formatNumber(data.kpi?.value)}
        </p>
        <p className="mt-1 truncate text-xs text-ink-2">{data.kpi?.label}</p>
      </div>
    );
  }

  if (spec.type === "table") return <DataTable data={data} />;

  if (data.rows.length === 0) {
    return <p className="px-1 text-xs text-ink-2">Sem dados para exibir.</p>;
  }

  const percentual = spec.valueMode === "percent";
  const empilhado = spec.stacked === true;
  const deitado = spec.type === "hbar";

  /** Número cheio, para onde há largura: legenda, tooltip. */
  const valorCheio = (value: number) => (percentual ? formatPercent(value) : formatNumber(value));
  /** Número curto, para eixo e rótulo sobre o dado. */
  const valorCurto = (value: number) => (percentual ? formatPercent(value) : formatCompact(value));

  /**
   * Onde o número fica em relação à marca. Empilhado ele vai para dentro do
   * segmento — do lado de fora, os rótulos de segmentos vizinhos se cobririam.
   */
  const posicaoDoRotulo: "top" | "right" | "center" = empilhado
    ? "center"
    : deitado
      ? "right"
      : "top";

  const rotuloDeValor = (cor: string) => ({
    position: posicaoDoRotulo,
    offset: empilhado ? 0 : 6,
    // Dentro do segmento não há superfície clara atrás do texto.
    fill: empilhado ? labelInkOn(cor, theme.ink.primary) : theme.ink.secondary,
    fontSize: 10,
    formatter: (value: string | number | boolean | null | undefined) =>
      typeof value === "number" ? valorCurto(value) : "",
  });

  // Legenda sempre presente a partir de 2 séries; com 1 série o título já a nomeia.
  const showLegend = data.series.length > 1;
  const tooltip = (
    <Tooltip
      formatter={(value: unknown) =>
        typeof value === "number" ? valorCheio(value) : String(value ?? "—")
      }
      contentStyle={{
        borderRadius: 6,
        backgroundColor: theme.surface,
        border: `1px solid ${theme.ink.gridline}`,
        fontSize: 12,
        color: theme.ink.primary,
      }}
    />
  );
  const legend = showLegend ? (
    <Legend
      wrapperStyle={{ fontSize: 11, color: theme.ink.secondary }}
      iconType="circle"
      iconSize={8}
    />
  ) : null;

  if (spec.type === "pie") {
    const key = data.series[0].key;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.rows}
            dataKey={key}
            nameKey="label"
            innerRadius="45%"
            outerRadius="78%"
            isAnimationActive={false}
            // Anel na cor da superfície separa as fatias adjacentes.
            stroke={theme.surface}
            strokeWidth={2}
          >
            {data.rows.map((row, index) => (
              <Cell key={String(row.label)} fill={colorAt(palette, index)} />
            ))}
          </Pie>
          <Legend
            wrapperStyle={{ fontSize: 11, color: theme.ink.secondary }}
            iconType="circle"
            iconSize={8}
            // Casa pelo nome, e não pelo índice: a legenda do Recharts não
            // segue a ordem das fatias, e por índice cada número saía ao lado
            // do rótulo de outra fatia.
            formatter={(name: string) => {
              const linha = data.rows.find((row) => String(row.label) === name);
              const valor = linha?.[key];
              return typeof valor === "number" ? `${name} · ${valorCheio(valor)}` : name;
            }}
          />
          {tooltip}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  /**
   * Eixo das categorias em escala de banda nos três formatos.
   *
   * É o que alinha barra, linha e área: sem isto o Recharts põe o ponto da
   * linha na borda da área de plotagem (o primeiro em cima do eixo Y) enquanto
   * a barra fica no centro da faixa — a mesma categoria caía em lugares
   * diferentes conforme o formato.
   */
  const eixoDeCategoria = {
    dataKey: "label",
    scale: "band" as const,
    allowDuplicatedCategory: false,
    // Zero: mostra todos. O padrão do Recharts esconde o que não cabe, e um
    // rótulo escondido deixa a barra sem nome nenhum.
    interval: 0 as const,
    ...axisProps,
  };

  const eixo = planoDoEixo(size, data.rows.length);

  if (deitado) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data.rows}
          layout="vertical"
          // À direita, espaço para o número que fica na ponta da barra.
          margin={{ top: 4, right: 44, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke={theme.ink.gridline} strokeDasharray="0" horizontal={false} />
          <XAxis type="number" {...axisProps} tickFormatter={valorCurto} />
          <YAxis
            type="category"
            {...eixoDeCategoria}
            width={SIDE_AXIS_WIDTH}
            tickFormatter={shortenSideTick}
          />
          {data.series.map((series, index) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              fill={colorAt(palette, index)}
              stackId={empilhado ? "empilha" : undefined}
              // Empilhado, arredondar cada segmento parte a barra visualmente.
              radius={empilhado ? 0 : [0, 4, 4, 0]}
              isAnimationActive={false}
            >
              <LabelList dataKey={series.key} {...rotuloDeValor(colorAt(palette, index))} />
            </Bar>
          ))}
          {legend}
          {tooltip}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const grid = (
    <CartesianGrid stroke={theme.ink.gridline} strokeDasharray="0" vertical={false} />
  );
  const axes = (
    <>
      <XAxis
        {...eixoDeCategoria}
        angle={eixo.inclinado ? -45 : 0}
        textAnchor={eixo.inclinado ? "end" : "middle"}
        height={eixo.altura}
        tickMargin={eixo.inclinado ? 8 : 4}
        tickFormatter={(value: unknown) => encurtaAte(value, eixo.orcamento)}
      />
      <YAxis {...axisProps} tickFormatter={valorCurto} width={LARGURA_DO_EIXO_Y} />
    </>
  );
  // Espaço no topo para o rótulo do ponto mais alto não sair cortado.
  const margin = { top: 16, right: 8, bottom: 0, left: 0 };

  if (spec.type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.rows} margin={margin}>
          {grid}
          {axes}
          {data.series.map((series, index) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={colorAt(palette, index)}
              strokeWidth={2}
              // O ponto ancora o número: sem ele o rótulo flutua sobre a curva.
              dot={{ r: 2.5, fill: colorAt(palette, index), strokeWidth: 0 }}
              isAnimationActive={false}
            >
              <LabelList dataKey={series.key} {...rotuloDeValor(colorAt(palette, index))} />
            </Line>
          ))}
          {legend}
          {tooltip}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (spec.type === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.rows} margin={margin}>
          {grid}
          {axes}
          {data.series.map((series, index) => (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={colorAt(palette, index)}
              strokeWidth={2}
              fill={colorAt(palette, index)}
              fillOpacity={empilhado ? 0.75 : 0.15}
              stackId={empilhado ? "empilha" : undefined}
              dot={{ r: 2.5, fill: colorAt(palette, index), strokeWidth: 0 }}
              isAnimationActive={false}
            >
              <LabelList dataKey={series.key} {...rotuloDeValor(colorAt(palette, index))} />
            </Area>
          ))}
          {legend}
          {tooltip}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data.rows} margin={margin}>
        {grid}
        {axes}
        {data.series.map((series, index) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            name={series.label}
            fill={colorAt(palette, index)}
            stackId={empilhado ? "empilha" : undefined}
            // Ponta arredondada só no topo, ancorada na linha de base.
            radius={empilhado ? 0 : [4, 4, 0, 0]}
            isAnimationActive={false}
          >
            <LabelList dataKey={series.key} {...rotuloDeValor(colorAt(palette, index))} />
          </Bar>
        ))}
        {legend}
        {tooltip}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * A primeira coluna é o rótulo da linha — "DÉFICIT DE VAGAS", "Presos
 * Provisórios" —, e não um número de ordem. Sem ela a tabela era uma parede de
 * valores sem dizer de que eram.
 *
 * Números alinham à direita e em largura fixa de dígito, que é o que permite
 * comparar ordens de grandeza percorrendo a coluna com o olho.
 */
function DataTable({ data }: { data: ChartData }) {
  const temDescritor = data.categoryLabel !== "";

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-gridline">
            {temDescritor ? (
              <th className="px-2 py-1 font-medium text-ink-2">{data.categoryLabel}</th>
            ) : null}
            {data.series.map((series) => (
              <th key={series.key} className="px-2 py-1 text-right font-medium text-ink-2">
                {series.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, index) => (
            <tr key={index} className="border-b border-gridline last:border-0">
              {temDescritor ? (
                <td className="px-2 py-1 font-medium text-ink">{String(row.label)}</td>
              ) : null}
              {data.series.map((series) => {
                const valor = row[series.key];
                return (
                  <td
                    key={series.key}
                    className={`px-2 py-1 text-ink ${
                      typeof valor === "number" ? "text-right tabular-nums" : ""
                    }`}
                  >
                    {typeof valor === "number" ? formatNumber(valor) : String(valor ?? "—")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
