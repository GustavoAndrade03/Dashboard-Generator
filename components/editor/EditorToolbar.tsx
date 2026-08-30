"use client";

/**
 * Barra de ações do editor.
 *
 * Nenhuma ação pede confirmação: desfazer resolve (CLAUDE.md, 11.7). Trocar de
 * template também não, porque desde que o dashboard passou a ter quantas
 * folhas forem necessárias ele apenas reposiciona — nunca descarta um gráfico.
 *
 * Fica grudada no topo: com várias folhas empilhadas, "Gerar PDF" tem de
 * continuar ao alcance sem rolar de volta. Pelo mesmo motivo as ferramentas da
 * planilha são botões daqui, e não seções perdidas no fim da página.
 */

import { PALETTES, type PaletteId } from "@/lib/dashboard/palettes";
import { TEMPLATES } from "@/lib/dashboard/templates";

/** Qual ferramenta da planilha está aberta abaixo da barra. */
export type ToolPanel = "dados" | "colunas" | null;

interface EditorToolbarProps {
  templateId: string;
  paletteId: PaletteId;
  pageCount: number;
  canUndo: boolean;
  canRedo: boolean;
  openPanel: ToolPanel;
  onUndo: () => void;
  onRedo: () => void;
  onTemplateChange: (id: string) => void;
  onPaletteChange: (id: PaletteId) => void;
  onTogglePanel: (panel: ToolPanel) => void;
  onAddChart: () => void;
  onPrint: () => void;
}

export function EditorToolbar({
  templateId,
  paletteId,
  pageCount,
  canUndo,
  canRedo,
  openPanel,
  onUndo,
  onRedo,
  onTemplateChange,
  onPaletteChange,
  onTogglePanel,
  onAddChart,
  onPrint,
}: EditorToolbarProps) {
  return (
    <div className="sticky top-0 z-20 -mx-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-[#e1e0d9] bg-[#f9f9f7] px-6 py-3 print:hidden">
      <div className="flex flex-wrap items-end gap-4">
        <Grupo rotulo="Organização">
          <select
            className={selectClass}
            aria-label="Organização dos gráficos na folha"
            value={templateId}
            onChange={(event) => onTemplateChange(event.target.value)}
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

        <Grupo rotulo="Sua planilha">
          <div className="flex gap-1.5">
            <BotaoSecundario
              onClick={() => onTogglePanel(openPanel === "dados" ? null : "dados")}
              pressed={openPanel === "dados"}
              title="Corrigir números e apagar linhas que não devem entrar nos gráficos"
            >
              Corrigir os dados
            </BotaoSecundario>
            <BotaoSecundario
              onClick={() => onTogglePanel(openPanel === "colunas" ? null : "colunas")}
              pressed={openPanel === "colunas"}
              title="Conferir como cada coluna da planilha foi entendida"
            >
              Conferir colunas
            </BotaoSecundario>
          </div>
        </Grupo>

        <Grupo rotulo="Histórico">
          <div className="flex gap-1.5">
            <BotaoSecundario onClick={onUndo} disabled={!canUndo} title="Ctrl+Z">
              Desfazer
            </BotaoSecundario>
            <BotaoSecundario onClick={onRedo} disabled={!canRedo} title="Ctrl+Shift+Z">
              Refazer
            </BotaoSecundario>
          </div>
        </Grupo>
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          {pageCount > 1 ? (
            <span className="text-xs text-[#898781]">{pageCount} páginas</span>
          ) : null}
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
        {/* A janela de impressão é onde o arquivo é salvo, e o caminho até lá
            não é óbvio para quem nunca imprimiu em PDF. */}
        <p className="text-[11px] text-[#898781]">
          Na janela que abrir, escolha “Salvar como PDF”.
        </p>
      </div>
    </div>
  );
}

const selectClass =
  "rounded border border-[#e1e0d9] bg-white px-2 py-1.5 text-xs text-[#0b0b0b] focus:border-[#2a78d6] focus:outline-none";

// Um `div` com rótulo, e não um `label`: a maioria destes grupos envolve
// botões, e clicar no texto de um label acionaria o primeiro deles.
function Grupo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[#898781]">{rotulo}</span>
      {children}
    </div>
  );
}

function BotaoSecundario({
  onClick,
  disabled = false,
  pressed,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      title={title}
      className={`rounded border px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6] ${
        pressed
          ? "border-[#2a78d6] bg-[#eef4fd] text-[#0b0b0b]"
          : "border-[#e1e0d9] text-[#52514e] hover:border-[#c3c2b7]"
      }`}
    >
      {children}
    </button>
  );
}
