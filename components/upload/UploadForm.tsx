"use client";

/**
 * Primeira tela. O usuário não sabe o que a ferramenta faz até ver o
 * resultado, então aqui só existe uma decisão a tomar: qual arquivo.
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
      className="flex flex-col gap-4 rounded-lg border border-[#e1e0d9] bg-[#fcfcfb] p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (file) onUpload(file);
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-[#0b0b0b]">Envie sua planilha</h2>
        <p className="mt-1 text-sm text-[#52514e]">
          Arquivos .xlsx. Nada precisa estar arrumado: a estrutura é detectada
          automaticamente e você corrige o que estiver errado na tela seguinte.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="sr-only"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-[#e1e0d9] bg-white px-4 py-2 text-sm font-medium text-[#0b0b0b] hover:border-[#2a78d6] hover:text-[#2a78d6] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
        >
          Escolher arquivo
        </button>
        <span className="min-w-0 truncate text-sm text-[#52514e]">
          {file ? file.name : "Nenhum arquivo escolhido"}
        </span>
      </div>

      <button
        type="submit"
        disabled={busy || !file}
        className="self-start rounded-md bg-[#0b0b0b] px-4 py-2 text-sm font-medium text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
      >
        {busy ? "Lendo sua planilha…" : "Gerar dashboard"}
      </button>
    </form>
  );
}
