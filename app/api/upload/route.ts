/**
 * Upload da planilha: executa a Camada 1 e, em seguida, a Camada 2.
 *
 * A resposta traz os dados normalizados e as sugestões de gráficos de uma vez
 * só — a abordagem é "adivinhar primeiro, corrigir depois" (CLAUDE.md, 2.4),
 * então não há passo intermediário de confirmação.
 */

import { NextResponse } from "next/server";

import { suggestCharts } from "@/lib/ai-suggestions/suggest-charts";
import { XlsxUploadDataSource } from "@/lib/data-sources/xlsx-upload";
import { buildParsedWorkbook, buildSchemaSummary } from "@/lib/parsing/schema-builder";

/** O exceljs é Node-only; a rota não pode rodar no runtime edge. */
export const runtime = "nodejs";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json(
      { error: "Formato não suportado. Envie um arquivo .xlsx." },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `Arquivo muito grande (limite de ${MAX_FILE_BYTES / 1024 / 1024} MB).` },
      { status: 413 },
    );
  }

  try {
    const source = new XlsxUploadDataSource({
      fileName: file.name,
      contents: Buffer.from(await file.arrayBuffer()),
    });

    const tables = await source.fetchTables();
    if (tables.length === 0) {
      return NextResponse.json(
        { error: "A planilha não tem nenhuma aba com conteúdo." },
        { status: 422 },
      );
    }

    const workbook = buildParsedWorkbook(source.descriptor, tables);
    if (workbook.tables.length === 0) {
      return NextResponse.json(
        { error: "Não foi possível identificar nenhuma tabela na planilha." },
        { status: 422 },
      );
    }

    const suggestion = await suggestCharts(buildSchemaSummary(workbook));

    return NextResponse.json({
      workbook,
      charts: suggestion.charts,
      provider: suggestion.provider,
      warning: suggestion.warning,
    });
  } catch (error) {
    console.error("[upload] falha ao processar a planilha", error);
    return NextResponse.json(
      { error: "Não foi possível ler a planilha. O arquivo pode estar corrompido." },
      { status: 422 },
    );
  }
}
