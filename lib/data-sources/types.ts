/**
 * Contrato comum a todas as fontes de dados.
 *
 * No MVP existe apenas `xlsx-upload`, mas todas as camadas acima (parsing,
 * sugestão de gráficos, editor) consomem dados através desta interface — nunca
 * do processo de upload diretamente. Isso mantém aberta a porta para fontes
 * externas (ex: Google Sheets com atualização automática) sem reescrever o
 * núcleo do sistema. Ver CLAUDE.md, seção 5.
 */

export type DataSourceKind = "xlsx-upload" | "google-sheets";

/** Valor de célula como veio da origem, antes de qualquer inferência de tipo. */
export type RawValue = string | number | boolean | Date | null;

/** Região de células mescladas, em índices 0-based da grade bruta. */
export interface MergeRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/**
 * Uma aba/tabela bruta: grade retangular de células sem nenhuma interpretação
 * de cabeçalho. As fontes de dados apenas relatam as mesclagens; quem as
 * resolve é `/lib/parsing/normalize.ts`, para que a heurística seja testável
 * sem depender de nenhum parser de arquivo.
 */
export interface RawTable {
  name: string;
  cells: RawValue[][];
  merges: MergeRange[];
}

/** Identificação persistível da origem — é o que vai para o banco. */
export interface DataSourceDescriptor {
  kind: DataSourceKind;
  label: string;
  /** Parâmetros específicos da origem (nome do arquivo, id da planilha remota, ...). */
  config: Record<string, unknown>;
}

export interface DataSource {
  readonly descriptor: DataSourceDescriptor;
  /** true quando a origem pode ser relida para atualizar o dashboard (futuro). */
  readonly supportsRefresh: boolean;
  fetchTables(): Promise<RawTable[]>;
}
