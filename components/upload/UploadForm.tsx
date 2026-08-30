"use client";

/**
 * Primeira tela. O usuário não sabe o que a ferramenta faz até ver o
 * resultado, então aqui só existe uma decisão a tomar: qual arquivo.
 *
 * O desenho ao lado é a explicação — o público-alvo nunca usou uma ferramenta
 * de BI, e "detectamos a estrutura automaticamente" não significa nada para
 * quem não sabe o que é estrutura. Ver a planilha torta virando folha branca
 * significa. Ele também ensina a regra de cor do editor antes do upload: o que
 * é branco é o que vai para o PDF.
 *
 * O seletor de arquivo nativo é escondido atrás de um botão nosso porque o
 * texto dele ("Choose file", "Nenhum arquivo selecionado") vem no idioma do
 * navegador, e não no da interface.
 */

import { useRef, useState } from "react";

interface UploadFormProps {
  onUpload: (file: File) => void;
  busy: boolean;
}

export function UploadForm({ onUpload, busy }: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  return (
    <form
      className="mx-auto grid w-full max-w-5xl items-center gap-10 rounded-[6px] border border-borda bg-bancada-alta p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12 lg:p-12"
      onSubmit={(event) => {
        event.preventDefault();
        if (file) onUpload(file);
      }}
    >
      <div className="min-w-0">
        <h2 className="expandida text-3xl font-semibold leading-[1.12] text-osso lg:text-4xl">
          A planilha que você já tem, pronta para imprimir.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-osso-fraco">
          Envie o .xlsx do jeito que ele está. As tabelas são reconhecidas
          sozinhas, os gráficos vêm sugeridos, e você ajusta o que ficou errado
          antes de salvar o PDF.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-[3px] border border-borda-forte px-4 py-2 text-sm text-osso transition-colors hover:bg-bancada disabled:opacity-50"
          >
            Escolher arquivo
          </button>

          <button
            type="submit"
            disabled={busy || !file}
            // Cheio apenas quando já há arquivo: um botão principal desativado
            // rouba a atenção da única ação que a tela aceita neste momento.
            className={`expandida rounded-[3px] px-4 py-2 text-sm font-semibold transition-colors ${
              file
                ? "bg-osso text-bancada hover:bg-white"
                : "border border-borda text-osso-fraco"
            }`}
          >
            {busy ? "Lendo sua planilha…" : "Gerar dashboard"}
          </button>

          <span className="min-w-0 flex-1 truncate text-xs text-osso-fraco">
            {file ? file.name : "Nenhum arquivo escolhido"}
          </span>
        </div>
      </div>

      <Transformacao />
    </form>
  );
}

/**
 * Antes e depois, com os materiais do próprio assunto: células desalinhadas de
 * um lado, folha branca do outro. Sem ícone e sem seta — a régua entre os dois
 * já diz que um vira o outro.
 */
function Transformacao() {
  return (
    <figure className="m-0 shrink-0">
      <svg
        viewBox="0 0 372 176"
        className="h-auto w-full max-w-[372px]"
        role="img"
        aria-label="À esquerda, uma planilha com células desalinhadas; à direita, a mesma informação como uma folha com gráficos."
      >
        {/* Planilha: faixa de título mesclada, blocos empilhados, buracos. É o
            arquivo real do usuário, não uma grade regular de brochura. */}
        <g stroke="#4d473e" fill="none" strokeWidth="1">
          <rect x="0.5" y="16.5" width="150" height="143" />
          <rect x="10.5" y="28.5" width="86" height="9" fill="#3a352e" stroke="none" />
          <g>
            <path d="M10.5 48.5h130M10.5 62.5h130M10.5 76.5h96M10.5 104.5h130M10.5 118.5h130M10.5 132.5h108" />
            <path d="M44.5 48.5v28M78.5 48.5v28M112.5 48.5v14M44.5 104.5v28M78.5 104.5v42M112.5 104.5v28" />
          </g>
          <rect x="10.5" y="88.5" width="60" height="9" fill="#3a352e" stroke="none" />
        </g>

        {/* A régua entre os dois estados. */}
        <path d="M162 88h48" stroke="#4d473e" strokeWidth="1" />
        <path d="M186 83v10" stroke="#9e968a" strokeWidth="1" />

        {/* A folha. Branca de propósito: é a mesma regra que vale no editor. */}
        <g>
          <rect x="221" y="16" width="151" height="144" fill="#ffffff" />
          <rect x="231" y="28" width="64" height="7" fill="#0b0b0b" />
          <rect x="231" y="41" width="40" height="4" fill="#c3c2b7" />
          <g fill="#2a78d6">
            <rect x="231" y="118" width="17" height="26" />
            <rect x="254" y="98" width="17" height="46" />
            <rect x="277" y="108" width="17" height="36" />
            <rect x="300" y="82" width="17" height="62" />
          </g>
          <path d="M231 144.5h131" stroke="#c3c2b7" strokeWidth="1" />
          <g fill="#e1e0d9">
            <rect x="327" y="82" width="35" height="4" />
            <rect x="327" y="92" width="28" height="4" />
            <rect x="327" y="102" width="35" height="4" />
            <rect x="327" y="112" width="22" height="4" />
          </g>
        </g>

        <text x="0" y="8" className="utilitaria" fill="#9e968a">
          sua planilha
        </text>
        <text x="221" y="8" className="utilitaria" fill="#9e968a">
          o PDF
        </text>
      </svg>
    </figure>
  );
}
