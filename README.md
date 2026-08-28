# Planilha em Dashboard

Transforma planilhas `.xlsx` desestruturadas em dashboards visuais customizáveis,
exportáveis em PDF. As diretrizes de produto e arquitetura estão em
[CLAUDE.md](CLAUDE.md).

```
Upload .xlsx → inferência de estrutura → revisão pelo usuário
→ sugestão de gráficos → customização → PDF
```

## Rodando localmente

```bash
npm install
npm run dev          # http://localhost:3000
```

Não é preciso configurar nada para usar: sem banco e sem chave de IA, o fluxo
completo (upload → revisão → gráficos → PDF) funciona, apenas com as sugestões
vindas da heurística em vez do modelo.

A exportação é o `Exportar PDF`, que abre a janela de impressão do navegador —
o usuário vê o arquivo final ali e escolhe "Salvar como PDF". Não há geração de
PDF no servidor.

Para gerar uma planilha de teste propositalmente bagunçada:

```bash
node tests/fixtures/make-sample-xlsx.mjs amostra.xlsx
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build de produção e execução |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Suíte de testes (Vitest) |
| `npm run test:watch` | Testes em modo watch |
| `npx vitest run tests/parsing/infer-types.test.ts` | Um único arquivo de teste |
| `npx vitest run -t "formato brasileiro"` | Um único teste pelo nome |
| `npm run db:generate` | Regenera o Prisma Client |
| `npm run db:migrate` | Cria/aplica migration em desenvolvimento |
| `npm run db:deploy` | Aplica migrations em produção |
| `npm run user:create -- <email> <senha> ["Nome"]` | Cria um usuário |

## Configuração

Copie `.env.example` para `.env`. Todas as variáveis são opcionais em
desenvolvimento:

| Variável | Efeito quando ausente |
|---|---|
| `DATABASE_URL` | Sem persistência de dashboards e sem login |
| `ANTHROPIC_API_KEY` | Sugestões vêm da heurística, com aviso na tela |
| `AUTH_SECRET` | Aplicação roda aberta, sem exigir login |

## Estrutura

```
app/                    rotas (workspace, login, API de upload)
components/             upload, revisão de schema, editor e gráficos
lib/
  data-sources/         contrato DataSource + implementação .xlsx
  parsing/              Camada 1 — heurística determinística
  ai-suggestions/       Camada 2 — Claude, com fallback heurístico
  dashboard/            modelo do dashboard, agregação e paleta
prisma/                 schema do banco
tests/                  testes da Camada 1 e da agregação
```

O detalhamento das camadas, das fronteiras entre módulos e das decisões de
stack está em [CLAUDE.md](CLAUDE.md).

## Testes

A cobertura se concentra na Camada 1 (detecção de cabeçalho, inferência de
tipo, normalização) e na agregação dos gráficos — é onde mora o maior risco do
produto. A Camada 2 não é testada contra a API real: o caminho de degradação
para a heurística é que está coberto.
