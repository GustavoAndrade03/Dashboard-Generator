"use client";

import { useRef, useState } from "react";

interface UploadFormProps {
  onUpload: (file: File) => void;
  busy: boolean;
}

export function UploadForm({ onUpload, busy }: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-[#e1e0d9] bg-[#fcfcfb] p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const file = inputRef.current?.files?.[0];
        if (file) onUpload(file);
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-[#0b0b0b]">Envie sua planilha</h2>
        <p className="mt-1 text-sm text-[#52514e]">
          Arquivos <code className="font-mono text-xs">.xlsx</code>. A estrutura é detectada
          automaticamente — você corrige o que estiver errado na tela seguinte.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        disabled={busy}
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
        className="block w-full text-sm text-[#52514e] file:mr-4 file:rounded-md file:border-0 file:bg-[#2a78d6] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#1c5cab] disabled:opacity-50"
      />

      <button
        type="submit"
        disabled={busy || !fileName}
        className="self-start rounded-md bg-[#0b0b0b] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {busy ? "Analisando planilha…" : "Gerar dashboard"}
      </button>
    </form>
  );
}
