"use client";

/**
 * Barra de ações do editor.
 *
 * Nenhuma ação destrutiva pede confirmação: desfazer resolve. A única exceção
 * é trocar para um template que não comporta todos os gráficos, porque aí
 * alguns saem da folha — esse caso avisa antes (CLAUDE.md, 11.5 e 11.7).
 */

import { useState } from "react";

import { PALETTES, type PaletteId } from "@/lib/dashboard/palettes";
import {
  TEMPLATES,
  getTemplate,
  templateCapacity,
} from "@/lib/dashboard/templates";

interface EditorToolbarProps {
  templateId: string;
  paletteId: PaletteId;
  chartCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTemplateChange: (id: string) => void;
  onPaletteChange: (id: PaletteId) => void;
  onAddChart: () => void;
  onPrint: () => void;
}

export function EditorToolbar({
  templateId,
  paletteId,
  chartCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onTemplateChange,
  onPaletteChange,
  onAddChart,
  onPrint,
}: EditorToolbarProps) {
  const [pendente, setPendente] = useState<string | null>(null);

  function pedirTroca(id: string) {
    const descartados = chartCount - templateCapacity(getTemplate(id));
    if (descartados > 0) setPendente(id);
    else onTemplateChange(id);
  }

  const descartados = pendente
    ? chartCount - templateCapacity(getTemplate(pendente))
    : 0;

  return (
    <div className="flex flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <Grupo rotulo="Organização">
            <select
              className={selectClass}
              value={templateId}
              onChange={(event) => pedirTroca(event.target.value)}
            >
              {TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
          </Grupo>

          <Grupo rotulo="Cores">
            <div className="flex gap-1.5">
              {PALETTES.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => onPaletteChange(palette.id)}
                  aria-pressed={paletteId === palette.id}
                  aria-label={`Paleta ${palette.label}`}
                  title={palette.label}
                  className={`flex gap-0.5 rounded border p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6] ${
                    paletteId === palette.id
                      ? "border-[#2a78d6]"
                      : "border-[#e1e0d9] hover:border-[#c3c2b7]"
                  }`}
                >
                  {palette.colors.slice(0, 4).map((color) => (
                    <span
                      key={color}
                      className="h-4 w-2 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </button>
              ))}
            </div>
          </Grupo>

          <Grupo rotulo="Histórico">
            <div className="flex gap-1.5">
              <BotaoSecundario
                onClick={onUndo}
                disabled={!canUndo}
                title="Ctrl+Z"
              >
                Desfazer
              </BotaoSecundario>
              <BotaoSecundario
                onClick={onRedo}
                disabled={!canRedo}
                title="Ctrl+Shift+Z"
              >
                Refazer
              </BotaoSecundario>
            </div>
          </Grupo>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddChart}
            className="rounded-md border border-[#e1e0d9] bg-white px-3 py-2 text-sm text-[#52514e] hover:border-[#2a78d6] hover:text-[#2a78d6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
          >
            Adicionar gráfico
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="rounded-md bg-[#0b0b0b] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2a28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
          >
            Gerar PDF
          </button>
        </div>
      </div>

      {pendente ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-[#eda100] bg-white px-3 py-2 text-xs text-[#52514e]">
          <span>
            “{getTemplate(pendente).label}” comporta{" "}
            {templateCapacity(getTemplate(pendente))} gráficos.{" "}
            {descartados === 1
              ? "1 gráfico sai"
              : `${descartados} gráficos saem`}{" "}
            da folha. Você pode desfazer depois.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onTemplateChange(pendente);
                setPendente(null);
              }}
              className="rounded bg-[#0b0b0b] px-3 py-1 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
            >
              Trocar mesmo assim
            </button>
            <button
              type="button"
              onClick={() => setPendente(null)}
              className="rounded border border-[#e1e0d9] px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
            >
              Manter como está
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const selectClass =
  "rounded border border-[#e1e0d9] bg-white px-2 py-1.5 text-xs text-[#0b0b0b] focus:border-[#2a78d6] focus:outline-none";

function Grupo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[#898781]">{rotulo}</span>
      {children}
    </label>
  );
}

function BotaoSecundario({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded border border-[#e1e0d9] px-2.5 py-1.5 text-xs text-[#52514e] hover:border-[#c3c2b7] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
    >
      {children}
    </button>
  );
}
