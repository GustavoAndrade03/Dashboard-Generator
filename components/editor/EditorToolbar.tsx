"use client";

/**
 * Barra de ações do editor — a bancada.
 *
 * Nenhuma ação pede confirmação: desfazer resolve (CLAUDE.md, 11.7). Trocar de
 * template também não, porque desde que o dashboard passou a ter quantas
 * folhas forem necessárias ele apenas reposiciona — nunca descarta um gráfico.
 *
 * Fica grudada no topo: com várias folhas empilhadas, "Gerar PDF" tem de
 * continuar ao alcance sem rolar de volta. Pelo mesmo motivo as ferramentas da
 * planilha são botões daqui, e não seções perdidas no fim da página.
 *
 * Só dois controles carregam rótulo: o seletor de organização e as paletas,
 * que não dizem sozinhos o que fazem. Os demais botões já são o próprio
 * rótulo, e repeti-lo acima deles engordava a barra em uma linha inteira.
 */

import { PALETTES, type PaletteId } from "@/lib/dashboard/palettes";
import { SHEET_THEMES, type SheetThemeId } from "@/lib/dashboard/themes";
import { TEMPLATES } from "@/lib/dashboard/templates";

/** Qual ferramenta da planilha está aberta abaixo da barra. */
export type ToolPanel = "dados" | "colunas" | null;

interface EditorToolbarProps {
  templateId: string;
  paletteId: PaletteId;
  themeId: SheetThemeId;
  pageCount: number;
  canUndo: boolean;
  canRedo: boolean;
  openPanel: ToolPanel;
  onUndo: () => void;
  onRedo: () => void;
  onTemplateChange: (id: string) => void;
  onFillSheets: () => void;
  onPaletteChange: (id: PaletteId) => void;
  onThemeChange: (id: SheetThemeId) => void;
  onTogglePanel: (panel: ToolPanel) => void;
  onAddChart: () => void;
  onPrint: () => void;
}

export function EditorToolbar({
  templateId,
  paletteId,
  themeId,
  pageCount,
  canUndo,
  canRedo,
  openPanel,
  onUndo,
  onRedo,
  onTemplateChange,
  onFillSheets,
  onPaletteChange,
  onThemeChange,
  onTogglePanel,
  onAddChart,
  onPrint,
}: EditorToolbarProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-borda bg-bancada/95 backdrop-blur print:hidden">
      <div className="mx-auto flex w-full max-w-[1460px] flex-wrap items-center justify-between gap-x-5 gap-y-3 px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2">
            <span className="utilitaria text-osso-fraco">Organização</span>
            <select
              className={selectClass}
              value={templateId}
              onChange={(event) => onTemplateChange(event.target.value)}
            >
              {TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
          </label>

          <BotaoBancada
            onClick={onFillSheets}
            title="Redistribui os gráficos para ocuparem a folha inteira, sem sobra embaixo"
          >
            Preencher a folha
          </BotaoBancada>

          <Divisor />

          <div role="group" aria-label="Cores" className="flex items-center gap-2">
            <span className="utilitaria text-osso-fraco">Cores</span>
            <div className="flex gap-1">
              {PALETTES.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => onPaletteChange(palette.id)}
                  aria-pressed={paletteId === palette.id}
                  aria-label={`Paleta ${palette.label}`}
                  title={palette.label}
                  className={`flex gap-px rounded-[3px] border p-1 transition-colors ${
                    paletteId === palette.id
                      ? "border-osso"
                      : "border-borda hover:border-borda-forte"
                  }`}
                >
                  {palette.colors.slice(0, 4).map((color) => (
                    <span key={color} className="h-4 w-1.5" style={{ backgroundColor: color }} />
                  ))}
                </button>
              ))}
            </div>
          </div>

          <Divisor />

          {/* Amostra do papel com um traço de tinta: o botão mostra a folha
              que ele produz, e não o nome de uma cor. */}
          <div role="group" aria-label="Folha" className="flex items-center gap-2">
            <span className="utilitaria text-osso-fraco">Folha</span>
            <div className="flex gap-1">
              {SHEET_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onThemeChange(theme.id)}
                  aria-pressed={themeId === theme.id}
                  aria-label={`Folha ${theme.label}`}
                  title={`${theme.label} — ${theme.hint}`}
                  className={`flex h-6 w-6 flex-col justify-center gap-[3px] rounded-[3px] border p-1 transition-colors ${
                    themeId === theme.id ? "border-osso" : "border-borda hover:border-borda-forte"
                  }`}
                  style={{ backgroundColor: theme.paper }}
                >
                  <span className="h-px w-full" style={{ backgroundColor: theme.ink.primary }} />
                  <span
                    className="h-px w-2/3"
                    style={{ backgroundColor: theme.ink.secondary }}
                  />
                </button>
              ))}
            </div>
          </div>

          <Divisor />

          <div className="flex gap-1">
            <BotaoBancada
              onClick={() => onTogglePanel(openPanel === "dados" ? null : "dados")}
              pressed={openPanel === "dados"}
              title="Corrigir números e apagar linhas que não devem entrar nos gráficos"
            >
              Corrigir os dados
            </BotaoBancada>
            <BotaoBancada
              onClick={() => onTogglePanel(openPanel === "colunas" ? null : "colunas")}
              pressed={openPanel === "colunas"}
              title="Conferir como cada coluna da planilha foi entendida"
            >
              Conferir colunas
            </BotaoBancada>
          </div>

          <Divisor />

          <div className="flex gap-1">
            <BotaoBancada onClick={onUndo} disabled={!canUndo} title="Ctrl+Z">
              Desfazer
            </BotaoBancada>
            <BotaoBancada onClick={onRedo} disabled={!canRedo} title="Ctrl+Shift+Z">
              Refazer
            </BotaoBancada>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {pageCount > 1 ? (
              <span className="utilitaria mr-1 text-osso-fraco">
                {pageCount} páginas
              </span>
            ) : null}
            <BotaoBancada onClick={onAddChart} title="Escolher uma sugestão ou montar um gráfico">
              Adicionar gráfico
            </BotaoBancada>
            {/* O único elemento preenchido do produto. Se houver dois botões
                cheios na tela, nenhum é o principal. */}
            <button
              type="button"
              onClick={onPrint}
              className="expandida rounded-[3px] bg-osso px-4 py-1.5 text-sm font-semibold text-bancada transition-colors hover:bg-white"
            >
              Gerar PDF
            </button>
          </div>
          {/* A janela de impressão é onde o arquivo é salvo, e o caminho até lá
              não é óbvio para quem nunca imprimiu em PDF. */}
          <p className="text-[11px] text-osso-fraco">
            Na janela que abrir, escolha “Salvar como PDF”.
          </p>
        </div>
      </div>
    </div>
  );
}

const selectClass =
  "rounded-[3px] border border-borda bg-bancada-alta px-2 py-1.5 text-xs text-osso transition-colors hover:border-borda-forte";

function Divisor() {
  return <span aria-hidden className="h-6 w-px bg-borda" />;
}

function BotaoBancada({
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
      className={`rounded-[3px] border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        pressed
          ? "border-osso bg-bancada-alta text-osso"
          : "border-borda text-osso-fraco hover:border-borda-forte hover:text-osso"
      }`}
    >
      {children}
    </button>
  );
}
