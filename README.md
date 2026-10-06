# sibs-brain

Wiki gerada a partir dos tweets de um único usuário do X.

```
X API v2 → worker (coleta → jev classifica → LLM valida os casos de dúvida → publica) → MongoDB → web (Next.js)
```

## Estrutura

| Pasta | O que faz |
|---|---|
| `apps/web` | Wiki pública + `/admin` (só você): edição, fila de revisão, gasto do mês |
| `apps/worker` | Pipeline; rode em cron (`npm run worker`) |
| `packages/core` | Tipos e schemas Zod |
| `packages/db` | Mongo, índices e controle de gasto (`usage`) |
| `packages/x-source` | Cliente da X API v2; reserva o custo antes de cada chamada |
| `packages/classifier` | jev (`@typesafe-ai/sdk`); temas iniciais em `seed-topics.ts` |
| `packages/validator` | LLM da OpenAI (`gpt-6-luna`, raciocínio `medium` por padrão) para os casos de baixa confiança |
| `packages/wiki-engine` | Threads → páginas + revisões |
| `packages/ask` | Embeddings, busca por similaridade, resposta da LLM e limite por visitante |

## Rodando

```sh
npm install
cp .env.example .env          # preencha as chaves
docker compose up -d          # ou use uma MONGODB_URI do Atlas
npm run hash-password -w @sibs/web -- "sua-senha"   # cole em ADMIN_PASSWORD_HASH
npm run worker                # coleta e gera as páginas
npm run dev                   # http://localhost:3000
```

## Roteamento por confiança do jev

- `≥ CONFIDENCE_PUBLISH` (0.8): publica direto, sem LLM (ou rejeita, se irrelevante)
- irrelevante com confiança `≥ 0.8`: rejeita sem LLM, mesmo com dúvida no tema
- a confiança considera só tema e relevância; dúvida no tipo não chama a LLM
- entre `CONFIDENCE_VALIDATE` (0.5) e 0.8, ou tema novo: a LLM valida
- `< 0.5`, LLM incerta ou orçamento da LLM esgotado: fila de revisão no `/admin`

## O que é coletado

Retweets nunca entram. Respostas também ficam de fora por padrão (`X_EXCLUDE_REPLIES=true`), o que
inclui a continuação das threads do próprio autor: cada thread fica só com o primeiro tweet. Com
`X_EXCLUDE_REPLIES=false` tudo entra, mas o custo e o volume sobem bastante.

`X_START_DATE` (AAAA-MM-DD) limita até onde o histórico volta.

## Subcategorias

Categorias maiores têm subcategorias, definidas em `packages/core/src/subtopics.ts`. O worker usa o jev
para escolher a subcategoria de cada post publicado nelas (abaixo de 50% de confiança, fica em "Outros")
e reclassifica quando o post muda de categoria ou a subcategoria sai da configuração. Na página da
categoria, pílulas menores filtram a grade e a timeline (`?sub=ia`).

## Perguntas (página inicial)

Qualquer visitante pode perguntar. O worker gera um vetor (`text-embedding-3-small`) para cada thread
publicada e guarda em `embeddings`; a pergunta vira um vetor, as 8 threads mais parecidas vão para um
modelo barato (`gpt-6-luna`) que responde citando os posts como [n].

| Variável | Padrão | Para quê |
|---|---|---|
| `CHAT_MAX_PER_HOUR` | 10 | perguntas por visitante por hora (o IP é guardado só como hash) |
| `CHAT_MONTHLY_BUDGET_BRL` | 10 | limite mensal das respostas; ao atingir, as perguntas pausam |
| `EMBED_MONTHLY_BUDGET_BRL` | 5 | limite mensal dos embeddings |
| `CHAT_MODEL` / `EMBEDDING_MODEL` | `gpt-6-luna` / `text-embedding-3-small` | modelos |
| `CHAT_USD_PER_MTOK_INPUT` / `_OUTPUT`, `EMBEDDING_USD_PER_MTOK` | 0.1 / 0.5, 0.02 | preços, para o controle de gasto |

## Orçamento

`X_MONTHLY_BUDGET_BRL` e `LLM_MONTHLY_BUDGET_BRL` são limites rígidos: cada chamada reserva o
pior caso antes de ir para a API e ajusta pelo custo real depois. Ajuste `X_COST_PER_TWEET_BRL`
para o preço atual da X.

Páginas editadas à mão nunca são sobrescritas pelo worker; novidades viram sugestões no `/admin`.

## Deploy (Vercel + MongoDB Atlas)

O site e o worker rodam na Vercel; o worker é um Cron Job (`apps/web/vercel.json`, uma vez por dia às 6h de Brasília) que chama
`/api/cron/worker`. A rota só aceita a Vercel (cabeçalho `Authorization: Bearer $CRON_SECRET`) e para de
classificar perto do limite de tempo da função, montando as páginas mesmo assim; o que faltar fica para a
próxima execução.

**Projeto na Vercel:** Root Directory `apps/web` (build `next build --webpack`, região `gru1`).

**Variáveis de ambiente (Settings → Environment Variables):**

| Variável | Obrigatória | Observação |
|---|---|---|
| `MONGODB_URI`, `MONGODB_DB` | sim | connection string do Atlas; libere o acesso da Vercel em *Network Access* |
| `CRON_SECRET` | sim | string aleatória longa (`openssl rand -hex 32`); protege o Cron |
| `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` | sim | login do `/admin` |
| `X_USERNAME`, `X_BEARER_TOKEN` | sim | coleta |
| `TYPESAFE_API_KEY` | sim | jev |
| `OPENAI_API_KEY` | sim | validação, perguntas e embeddings |
| `X_MONTHLY_BUDGET_BRL`, `X_COST_PER_TWEET_BRL`, `X_START_DATE`, `X_EXCLUDE_REPLIES` | não | padrões no código |
| `LLM_MONTHLY_BUDGET_BRL`, `VALIDATOR_*`, `CHAT_*`, `EMBED_*`, `EMBEDDING_*`, `USD_BRL` | não | padrões no código |
| `CONFIDENCE_PUBLISH`, `CONFIDENCE_VALIDATE` | não | padrões no código |

**Migrar o banco local para o Atlas:**

```sh
mongodump --db sibs-brain --out ./backup
mongorestore --uri "<connection string do Atlas>" ./backup
```

A primeira coleta (histórico) pode levar mais de uma execução; dá para rodá-la localmente com
`MONGODB_URI` apontando para o Atlas e `npm run worker`.
