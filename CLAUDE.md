# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Este arquivo orienta o Claude Code no desenvolvimento deste projeto. Leia por completo antes de gerar qualquer código.

---

## 1. Visão Geral do Projeto

Ferramenta web que transforma planilhas `.xlsx` desestruturadas em dashboards visuais customizáveis, exportáveis como `.pdf`.

**Fluxo principal:**
```
Upload .xlsx → Inferência automática de estrutura → Revisão/correção pelo usuário
→ Sugestão automática de gráficos (heurística + IA) → Customização do dashboard
→ Exportação em PDF
```

**Público-alvo:** usuários leigos em análise de dados, sem conhecimento técnico de BI. Escala inicial: **≤10 usuários**, uso semanal recorrente. Este é um MVP para validação, não um produto em escala — decisões de arquitetura devem refletir isso.

### 1.1 Estado atual

O scaffold está montado e o fluxo principal funciona de ponta a ponta: upload
→ Camada 1 → sugestões → edição → PDF (validado com uma planilha bagunçada de
teste, ver `tests/fixtures/`).

**Implementado:** contrato `DataSource` e o adaptador `.xlsx`; Camada 1
completa (leitura por blocos, mesclagens, detecção de cabeçalho, inferência de
tipo com parsing pt-BR); Camada 2 com degradação automática para heurística;
editor WYSIWYG da seção 11 (folhas A4 empilhadas, grade com
arrastar/redimensionar, painel contextual com recorte por indicador,
templates, paletas, desfazer/refazer, edição dos valores); exportação pela
janela de impressão do navegador, com uma página por folha; autenticação
(Auth.js); schema Prisma.

O relatório real que motivou a leitura por blocos fica em
`planilha_referencia.xlsx`, na raiz. Ele **não é versionado** (está no
`.gitignore`), então o teste de regressão que o usa
(`tests/parsing/split-blocks.test.ts`) é pulado quando o arquivo não está
presente — os testes sintéticos do mesmo arquivo cobrem as regras.

**Ainda não implementado:** persistência de dashboards — o schema existe, mas
nenhuma rota grava ou lê do banco, e nenhuma migration foi criada. Hoje o
estado do dashboard vive na página até ser exportado.

Rodar sem `DATABASE_URL`, `ANTHROPIC_API_KEY` e `AUTH_SECRET` é um caminho
suportado, não uma degradação acidental: o fluxo inteiro funciona, com
sugestões heurísticas e sem login. Ao mexer em qualquer camada, preserve isso.

### 1.2 Comandos

`npm run dev` · `npm run build` · `npm start` · `npm run lint` ·
`npm run typecheck` · `npm test` · `npm run test:watch`

Um único arquivo de teste: `npx vitest run tests/parsing/infer-types.test.ts`.
Um único teste pelo nome: `npx vitest run -t "formato brasileiro"`.

Banco: `npm run db:generate` (regenera o client), `npm run db:migrate`
(migration em dev), `npm run db:deploy` (produção).
Usuários: `npm run user:create -- <email> <senha> ["Nome"]` — não há cadastro
público.

Variáveis de ambiente e o que acontece na ausência de cada uma: `.env.example`
e o README.

---

## 2. Princípios Não-Negociáveis

Estes princípios têm prioridade sobre "boas práticas genéricas" ou sugestões de otimização prematura. Ao propor qualquer solução técnica, valide contra eles primeiro:

1. **Custo mínimo/zero.** Toda escolha de infraestrutura, serviço externo ou biblioteca deve priorizar tiers gratuitos. Não sugerir upgrade para planos pagos "por conveniência". Se uma solução gratuita exige mais esforço de implementação, mas mantém custo zero, prefira-a — desde que o esforço extra seja razoável para um MVP.
2. **Simplicidade sobre escalabilidade prematura.** Não introduzir filas assíncronas, microserviços, containers orquestrados (Kubernetes) ou infraestrutura distribuída. A escala do projeto (≤10 usuários, uso semanal) não justifica essa complexidade.
3. **Não fechar portas para o futuro.** Mesmo implementando apenas o essencial hoje, manter abstrações que permitam evoluir sem reescrever partes centrais (ver seção 5 — Extensibilidade).
4. **Abordagem "otimista" na inferência de dados.** O sistema tenta adivinhar a estrutura da planilha e o conteúdo do dashboard automaticamente; o usuário corrige depois. Não implementar fluxos de confirmação prévia passo a passo que atrapalhem a fluidez.

---

## 3. Stack Técnica

| Camada | Tecnologia | Notas |
|---|---|---|
| Framework full-stack | Next.js (TypeScript) | Frontend + API routes no mesmo projeto |
| Parsing de `.xlsx` | `exceljs` | Escolhido sobre o SheetJS: o pacote `xlsx` do npm está parado na 0.18.5 com CVEs. Expõe mesclagens e resultado de fórmula |
| IA (sugestão semântica) | Claude API — modelo Haiku | Usar o modelo mais barato disponível; prompt deve conter **apenas o schema estruturado**, nunca a planilha bruta inteira |
| Banco de dados | Postgres (Neon, free tier) | Verificar tier vigente no momento da implementação — políticas de free tier mudam com frequência |
| ORM | Prisma | Schema explícito, migrations versionadas |
| Autenticação | Auth.js (NextAuth) | Poucos usuários conhecidos; não implementar fluxo de cadastro público complexo |
| Gráficos (UI) | Recharts | Biblioteca padrão para os componentes de visualização |
| Geração de PDF | `window.print()` do navegador | O botão abre a janela de impressão, onde o usuário **vê o arquivo final** e salva como PDF. Não há geração no servidor: a folha impressa é a própria página, com tudo que não é dashboard marcado com `print:hidden` |
| Hospedagem | Render (free tier) | **Não usar Railway** (removeu free tier indefinido). Sem Puppeteer no servidor, a aplicação deixou de exigir processo persistente e memória alta — hospedagem serverless voltou a ser viável se algum dia compensar |

**Antes de instalar qualquer dependência não listada aqui**, avalie se ela é realmente necessária ou se a stack já cobre a necessidade.

---

## 4. Arquitetura e Estrutura de Pastas

Monolito modular. Módulos internos com fronteiras claras, mas sem separação em serviços/deploys distintos.

```
/app                       → rotas Next.js (upload, editor, export)
/lib
  /data-sources             → abstração de fonte de dados
    xlsx-upload.ts           → implementação atual (única fonte no MVP)
    types.ts                 → interface DataSource (contrato comum)
  /parsing                  → Camada 1: heurísticas determinísticas
    infer-types.ts            → inferência de tipo de coluna (data, numérica, categórica)
    detect-headers.ts         → detecção de cabeçalhos em planilhas desestruturadas
    schema-builder.ts         → produz o "resumo estruturado" usado pela Camada 2
  /ai-suggestions            → Camada 2: chamada à API da Anthropic
    suggest-charts.ts          → recebe o schema, retorna sugestões de gráficos
/components                  → editor de dashboard, componentes de gráfico, seleção de templates
/prisma                       → schema do banco de dados
```

### 4.1 Regra de dependência entre módulos

- `/lib/parsing` **nunca** deve depender de `/lib/ai-suggestions`. A Camada 1 deve funcionar de forma independente e produzir um resultado utilizável mesmo sem chamada de IA.
- `/lib/ai-suggestions` depende do output de `/lib/parsing` (o schema estruturado), não do arquivo `.xlsx` bruto.
- A impressão não tem módulo próprio: é a mesma árvore de componentes com regras `@media print`. Não crie uma segunda renderização do dashboard só para o PDF — duas implementações divergem, e a fidelidade é justamente o ponto.

### 4.2 Motor de sugestão de gráficos (as duas camadas)

**Camada 1 — Heurística (sem custo, sem IA):**
- Parsing e limpeza do `.xlsx` (múltiplas abas, células mescladas, linhas/colunas vazias).
- Inferência de tipo por coluna: data, numérica, categórica/texto, identificador único.
- Detecção de cabeçalhos reais quando não estão na primeira linha ou estão em formato irregular.
- Output: um schema estruturado (nomes de coluna, tipos, exemplos de valores, cardinalidade).

**Camada 2 — IA (custo mínimo):**
- Input: **somente** o schema estruturado produzido pela Camada 1 — nunca os dados brutos completos, por custo e por privacidade.
- Output: lista de sugestões de gráficos com justificativa (ex: coluna de data + coluna numérica → série temporal).
- Deve ser implementada de forma desacoplada do provedor específico — evitar espalhar chamadas diretas à API da Anthropic por múltiplos arquivos; centralizar em `suggest-charts.ts`.

---

## 5. Extensibilidade (não implementar agora, mas não travar depois)

O MVP atual só suporta upload de `.xlsx`. No futuro, está prevista integração com fontes de dados externas (ex: Google Sheets via API) com atualização automática do dashboard.

**Implicação prática para o código:**
- Toda fonte de dados deve implementar a interface `DataSource` definida em `/lib/data-sources/types.ts`, mesmo havendo hoje apenas uma implementação (`xlsx-upload.ts`).
- O motor de sugestão de gráficos (`/lib/ai-suggestions`) e o editor de dashboard (`/components`) devem consumir dados através dessa interface, nunca acoplados diretamente ao processo de upload de arquivo.
- O modelo de dados do dashboard (Prisma schema) deve representar "de onde vieram os dados" de forma genérica, não assumir implicitamente que a origem é sempre um arquivo.

Não implemente a integração com Google Sheets agora — apenas não crie acoplamentos que a tornem difícil de adicionar depois.

---

## 6. Fora do Escopo do MVP

Não implementar, a menos que explicitamente solicitado:

- Integração com fontes de dados externas (Google Sheets, APIs, etc.).
- Outros formatos de exportação além de `.pdf` (link compartilhável, apresentação, imagem).
- Upload de múltiplos arquivos / combinação de fontes de dados.
- Colaboração multi-usuário em um mesmo dashboard.
- Histórico de versões do dashboard.
- Sistema de cadastro/onboarding público — os usuários são conhecidos e poucos.
- Filas assíncronas, workers separados, cache distribuído.

Se uma tarefa parecer exigir algo desta lista, sinalize antes de implementar — provavelmente é escopo além do MVP.

---

## 7. Pontos de Atenção Conhecidos

1. **Qualidade da inferência automática (Camada 1) é o maior risco do produto.** Planilhas muito bagunçadas podem quebrar a detecção de estrutura. Priorize robustez e tratamento de casos extremos nessa camada.
2. **UX da correção pós-sugestão precisa ser simples.** Como a abordagem é "adivinha primeiro, corrige depois", a interface de correção/edição é tão importante quanto o motor de sugestão em si.
3. **Fidelidade do PDF ao dashboard customizado.** Como o PDF é a própria página impressa, a fidelidade vem de graça em conteúdo — mas não em largura: o `ResponsiveContainer` do Recharts mede em JS, então a folha é fixada em 1031px (largura útil do A4 paisagem com margem de 12mm, arredondada para baixo) para que tela e papel tenham a mesma medida. Ao mexer no layout da folha, preserve isso — inclusive o arredondamento para baixo: um pixel a mais que a caixa da página faz o Chrome abrir uma folha em branco depois de cada folha cheia. Em contrapartida, margens, escala e "gráficos de segundo plano" agora dependem das configurações de impressão do usuário.
4. **Prompt da Camada 2 deve permanecer pequeno.** Nunca enviar a planilha inteira ou grandes volumes de dados brutos para a API de IA — apenas o schema resumido.

---

## 8. Convenções Gerais

- TypeScript em todo o projeto (evitar `any` sem justificativa).
- Preferir componentes funcionais React com hooks.
- Nomes de arquivos e pastas em inglês (padrão do ecossistema Next.js/React); comentários e mensagens voltadas ao usuário final podem ser em português, conforme o idioma da interface do produto.
- Toda nova dependência externa deve ser justificada — este é um projeto que preza por poucas dependências e custo mínimo de manutenção.

---

## 9. Ao Iniciar uma Nova Tarefa

Antes de implementar, verifique:
- A tarefa respeita os princípios da Seção 2 (custo, simplicidade, extensibilidade)?
- A tarefa está dentro do escopo do MVP (Seção 6)?
- A tarefa respeita as fronteiras de módulo da Seção 4.1?

Se a resposta a qualquer uma dessas perguntas não for clara, é preferível perguntar antes de implementar do que assumir.

---

## 10. Decisões Registradas

Escolhas já feitas, com o porquê. Não as reabra sem um motivo novo.

| Decisão | Por quê |
|---|---|
| **exceljs** para `.xlsx` | O pacote `xlsx` (SheetJS) do npm está parado na 0.18.5 com vulnerabilidades conhecidas; a edição community migrou para CDN próprio. O exceljs é instalável pelo npm, expõe mesclagens e o resultado calculado de fórmulas |
| **`window.print()`** em vez de Puppeteer no servidor | O usuário pediu para ver o arquivo final antes de salvar, e a janela de impressão já é esse visualizador. De quebra elimina o download de ~200 MB de Chromium a cada `npm install` e o consumo de memória que ele exigiria no free tier. O custo é abrir mão da saída determinística: margens e escala passam a depender do que o usuário escolher no diálogo |
| **Render** para hospedagem | Fly.io encerrou o free allowance para novas contas. Confira o tier vigente antes de publicar |
| **Vitest** para testes | Roda TypeScript sem configuração e é rápido o bastante para a Camada 1, que é onde os testes precisam existir |
| **Tailwind** para estilo | Já vem no scaffold do Next e não adiciona custo em runtime; alternativa era CSS Modules e muito mais CSS à mão |
| **zod** | Valida a resposta da IA antes de confiar nela. Sem isso, uma alucinação de nome de coluna quebraria o editor |
| **scrypt do Node** para senhas | Evita bcrypt/argon2; a biblioteca padrão resolve, e são poucos usuários |
| **Prisma 7 + `@prisma/adapter-pg`** | A v7 removeu o engine Rust: o driver adapter é obrigatório, não uma opção |
| **Dados em coluna `Json`** | Nenhum free tier oferece storage de arquivo confiável. Para milhares de linhas, JSON no Postgres é suficiente e não adiciona infraestrutura |
| **Tema claro único** | O PDF é a própria página impressa; um tema que segue a preferência do sistema faria o arquivo divergir do que está na tela |
| **Fluxo todo em uma rota** | Os dados normalizados passam de alguns MB. Navegar entre rotas exigiria `sessionStorage` (que estoura) ou banco (que não deve ser obrigatório para usar a ferramenta) |
| **`react-grid-layout`** no canvas | Arrastar, redimensionar, snap, compactação e teto de linhas prontos e testados. Escrever colisão e compactação à mão seriam centenas de linhas frágeis para o mesmo resultado. A v2 passa `nodeRef` ao `react-draggable`, então não esbarra no `findDOMNode` removido no React 19 |
| **Paletas como reordenações das mesmas 8 matizes** | A ordem dos slots é o mecanismo de segurança para daltonismo, não enfeite. Cada paleta oferecida foi validada com o script do guia de visualização; ordenações inventadas à mão reprovaram |
| **Leitura por blocos, não por aba** | Relatórios reais empilham vários quadros numa aba só. Tratar a aba como uma tabela produzia lixo: cabeçalho errado, tipos errados, tudo num balaio. A unidade de leitura passou a ser o bloco, delimitado por linhas em branco e por faixas de título mescladas |
| **Descartar o que a mesclagem duplica** | Uma mesclagem vertical chega como linha repetida e uma horizontal como coluna repetida (o `I:J` do TOTAL virava duas colunas idênticas). A regra é exata, não heurística: a célula pertence a uma mesclagem que começou antes dela. Vale **por bloco**, porque a mesma coluna é mesclada num quadro e independente em outro |
| **Linhas de fechamento fora dos gráficos por padrão** | Plotar "Subtotal" ao lado das parcelas que ele soma achata todas as barras. Fica de fora por padrão, com uma opção visível no painel para incluir |
| **Proteção condicional a `AUTH_SECRET`** | Mantém o desenvolvimento local sem nenhum setup, e liga a exigência de login em qualquer ambiente que defina o segredo |
| **Uma grade por folha, e não uma grade contínua** | Para o dashboard crescer além de uma página, a alternativa era uma grade única fatiada pela impressão. O Chrome não fragmenta de forma confiável conteúdo posicionado em absoluto (que é como o `react-grid-layout` posiciona tudo), e um gráfico cortado ao meio no PDF é justamente o defeito que não pode existir. Folhas separadas, cada uma no fluxo normal com `break-before: page`, tornam a paginação exata. O preço é não arrastar um gráfico de uma folha para a outra — daí o campo "Página" no painel |
| **Legenda da pizza casada pelo nome, não pelo índice** | O índice que o Recharts passa ao `formatter` da legenda não segue a ordem das fatias. Pareando por índice, cada número saía ao lado do rótulo de outra fatia — errado de um jeito que ninguém percebe olhando. A busca é pelo nome da linha |
| **Ferramentas da planilha na barra de ações** | "Corrigir os dados" e "Conferir colunas" eram duas seções recolhidas no fim da página. Com o dashboard passando a ter várias folhas, o fim da página ficou a três telas de distância — ninguém acharia. Viraram botões da barra fixa, e o painel abre logo abaixo dela, sem custar altura quando fechado |
| **"Mais opções" no painel do gráfico** | O painel tinha oito campos, dois deles exigindo saber o que é agregação ("Cálculo", "Incluir linhas de total"). São os que quase nunca mudam. Fechados, a primeira leitura do painel tem só decisões que o público-alvo entende |
| **Folha de 700px, e não os 703px do papel** | A folha desenhada é o título mais a grade cheia, não a área útil inteira do A4. A sobra de 3px é a folga que garante que a folha seguinte comece numa página nova. Com a folha exatamente do tamanho do papel, o Chrome abria uma página em branco depois de cada folha cheia — foi o que aconteceu na primeira versão, com a margem entre folhas em estilo inline (que não zera na impressão) |

### 10.1 Limitações conhecidas da Camada 1

- Colunas numéricas cujos valores são **inteiros distintos e quase
  consecutivos** são classificadas como `identifier` (confiança 0.6) mesmo
  quando são medidas. É o preço de detectar colunas de código; a UI de revisão
  marca "confira" e o usuário corrige.
- Um bloco só é reconhecido quando as faixas de título estão mescladas de ponta
  a ponta ou há linhas em branco separando os quadros. Quadros colados um no
  outro, sem separação nenhuma, continuam virando uma tabela só.
- A detecção de cabeçalho exige que a linha seja majoritariamente texto, então
  planilhas cujo cabeçalho são apenas anos (`2022 2023 2024`) caem no
  nome gerado (`Coluna A`).

---

## 11. Editor WYSIWYG

O editor é o coração do produto: é onde o usuário revisa as sugestões
automáticas de gráficos e ajusta o dashboard antes de exportar em PDF.

**Perfil do usuário:** pessoa leiga em análise de dados. Não sabe o que é
"série temporal", "eixo categórico" ou "agregação". Nunca usou Power BI. Hoje
monta gráficos manualmente no Excel e acha isso trabalhoso. Precisa conseguir ir
do upload ao PDF sem ajuda externa e sem ler documentação.

**Escala:** ≤10 usuários, uso semanal. Não otimizar para escala ou concorrência.

### 11.1 Requisito central: WYSIWYG real

O que o usuário edita na tela é exatamente o que sai no PDF. Isso não é
negociável e tem três implicações obrigatórias:

- **Não existe "modo preview".** Não implemente botão de visualização nem
  alternância entre "modo edição" e "modo visualização". A tela de edição já é
  a representação fiel do resultado.
- **A área de edição tem as proporções da página do PDF** (A4, paisagem). O
  usuário vê os limites da folha enquanto edita e entende naturalmente o que
  cabe e o que não cabe. Quando não cabe, a folha seguinte aparece embaixo —
  ver 11.2.
- **A exportação imprime esse mesmo componente**, sem uma segunda
  implementação de layout. Se você se pegar escrevendo lógica de layout
  duplicada (uma para a tela, outra para o PDF), pare — a arquitetura está
  errada.

### 11.2 Canvas do dashboard

- Área central representando a página do PDF, com os gráficos posicionados.
- Grade de 12 colunas com "snap": o usuário reposiciona e redimensiona por
  arrastar/soltar, e a peça encaixa sozinha.
- O layout não pode quebrar. Restrinja as possibilidades em vez de dar
  liberdade total — liberdade total gera resultados feios nas mãos de um leigo.
  Na prática: compactação vertical automática (sem buracos) e teto de linhas
  igual à altura da folha.
- **O dashboard tem quantas folhas forem necessárias**, empilhadas na vertical
  e roladas pela página. O teto de linhas continua valendo por folha: é ele que
  impede um gráfico de atravessar a quebra de página e sair cortado no PDF.
  Cada folha é uma grade independente, e a quebra de impressão cai entre elas.
- A folha só existe enquanto tem gráfico. Esvaziou, some — senão o PDF sairia
  com uma página em branco que o usuário não pediu.
- Mover um gráfico de folha é o campo "Página" do painel contextual, que
  também oferece "Nova página". Arrastar atravessando a borda da folha não
  funciona: são grades separadas, e essa é a troca que compra a paginação
  correta.

### 11.3 Seleção e edição contextual

- Clicar em um gráfico o seleciona, com indicação visual clara.
- Com um gráfico selecionado, as opções aparecem em um painel contextual,
  aplicando-se apenas àquele gráfico.
- Opções por gráfico:
  - **Trocar o tipo** — alternativas como miniaturas visuais do resultado,
    nunca como lista de nomes técnicos.
  - **Trocar os dados** — seletores com os nomes das colunas da planilha do
    usuário, exatamente como estão no arquivo dele.
  - **Recortar por indicador** — ver 11.3.1.
  - **Editar o título** — inline, clicando direto no título no canvas.
  - **Remover**.
- Nunca exigir que o usuário abra um menu genérico e depois escolha a qual
  gráfico a configuração se aplica.

### 11.3.1 Os três níveis de um relatório em matriz

Os relatórios do usuário têm uma hierarquia que o editor precisa expor inteira:

| Nível | Onde mora na planilha | Controle no painel |
|---|---|---|
| **Quadro** | a faixa de título da seção | "Quadro" |
| **Indicador** | o rótulo na coluna da esquerda | "Mostrar apenas" |
| **Unidade ou total** | as colunas do cabeçalho | "Colunas com os valores" |

O recorte por indicador vale para **todos os formatos**, inclusive número e
tabela — é o que permite "o déficit de vagas do PAMC" ser um número só.

Quando o recorte deixa **um indicador e várias unidades**, as unidades passam
a ser o eixo. Sem isso o gráfico teria uma categoria só e toda a leitura
ficaria na legenda; com isso, sai o gráfico que o usuário quis dizer ao pedir
"déficit de vagas por unidade".

Recorte vazio significa "todos", nunca "nenhum": um indicador acrescentado na
edição de valores entra sozinho, em vez de ficar invisível. E se o indicador
selecionado for renomeado ou apagado, o recorte cai fora e volta a valer
"todos" — degradação visível, em vez de um gráfico misteriosamente vazio.

### 11.4 Adicionar gráficos

- Botão claro para adicionar um gráfico.
- Oferecer **primeiro** as sugestões restantes da Camada 2 — aquelas que não
  couberam no dashboard inicial —, como opções prontas com preview visual.
- Só depois oferecer montar um gráfico do zero escolhendo colunas.

### 11.5 Templates de layout

- Seletor de layouts prontos (1 grande + 2 pequenos, grade 2x2, coluna única).
- Trocar de template **reposiciona** os gráficos existentes, não os apaga.
  Nenhum gráfico é descartado nem precisa de aviso prévio: quando as vagas de
  uma folha acabam, o template abre a folha seguinte.

### 11.6 Customização visual (escopo enxuto)

- Paletas de cores pré-definidas e harmônicas. **Sem color picker livre** —
  usuário leigo com liberdade total de cor produz dashboards ilegíveis.
- Título geral do dashboard, editável inline.

### 11.7 Undo / Redo

- Obrigatório, com atalhos (Ctrl+Z / Ctrl+Shift+Z) e botões visíveis.
- Nenhuma ação destrutiva pede confirmação por modal — a reversibilidade
  substitui a confirmação. Não há exceção: desde que o dashboard passou a ter
  quantas folhas forem necessárias, nem trocar de template descarta gráficos.

### 11.8 Gerar PDF

- Botão de ação primária, sempre visível e sem ambiguidade.
- A ação abre a janela de impressão do navegador, que é onde o usuário vê o
  arquivo final e escolhe salvar.
- Não há estado de carregamento nem falha de geração a tratar: nada é gerado no
  servidor. (Este item exigia ambos quando a exportação era feita por
  Puppeteer; ver seção 10.)

### 11.9 Diretrizes de escrita da interface

- **Vocabulário do usuário, não do sistema.** "Colunas da sua planilha", não
  "campos do schema". "Trocar tipo de gráfico", não "alterar chart type".
- **Aviso técnico não vai para a interface.** Nome de variável de ambiente,
  "schema", "heurística", "IA": o usuário não pode agir sobre nada disso. Se a
  aplicação seguiu por um caminho alternativo e o resultado está lá, ele não
  vira alerta — vai para o log do servidor. Alerta só quando existe algo a
  fazer.
- **Voz ativa e consistente.** O botão que diz "Gerar PDF" produz uma mensagem
  que diz "PDF gerado". A mesma ação mantém o mesmo nome em toda a interface.
- **Estados vazios são convites à ação**, não avisos. Um canvas sem gráficos
  diz o que fazer em seguida.
- **Erros explicam causa e solução**, sem se desculpar e sem vagueza, e
  aparecem perto do que os provocou — não no topo de uma página que pode ter
  várias folhas de altura.
- **Toda ação tem retorno visível.** Um botão que só revela um painel já
  visível parece quebrado; nesse caso ele move o foco, que é o retorno.
- Interface em português (pt-BR), em sentence case, sem jargão técnico em
  nenhuma label visível.

### 11.10 Diretrizes de implementação

- Componentes React funcionais com TypeScript.
- Gráficos com Recharts, encapsulados em um componente que recebe a
  configuração como prop — nunca lógica de dados dentro do componente visual.
- **Todo gráfico mostra os números, não só a forma.** Barras trazem o valor
  acima da barra; linha e área, sobre o ponto (com o ponto desenhado, que é a
  âncora do rótulo); a pizza põe o valor ao lado do nome na legenda; a tabela
  abre com a coluna do indicador à esquerda dos números. O rótulo sobre o dado
  usa formato curto ("1,3 mil") — o valor por extenso não cabe num cartão de
  meia folha; a legenda e a tabela, que têm largura, usam o número cheio.
- O estado do dashboard (gráficos, posições, template, paleta, títulos) é um
  **objeto serializável único**, persistível no banco e consumível pela
  impressão sem transformação adicional.
- O editor consome dados através da interface `DataSource` (seção 5) — não
  acoplar ao upload de arquivo.
- Acessibilidade mínima: foco de teclado visível, navegação por teclado nos
  controles principais, respeito a `prefers-reduced-motion`.
- Responsivo o suficiente para telas menores, mas o editor pode assumir
  desktop como cenário principal.

### 11.11 Edição dos valores da planilha

O usuário corrige os dados **dentro do editor** — corrigir no arquivo e
reenviar é justamente o trabalho que a ferramenta existe para evitar.

- Uma tabela editável por quadro, com seleção de quadro quando houver mais de um.
- O valor digitado passa pelo mesmo parsing da Camada 1: "1.234,50" numa coluna
  numérica vira 1234,5, igual viria da planilha.
- Apagar e acrescentar linhas também: é assim que o usuário tira do gráfico uma
  linha de "Subtotal" que não deveria estar ali.
- Toda alteração é um passo do histórico e reflete nos gráficos na hora.

### 11.12 Fora do escopo desta parte

Colaboração em tempo real, comentários, histórico de versões do dashboard,
exportação em outros formatos, fórmulas ou colunas calculadas.

---

@AGENTS.md
