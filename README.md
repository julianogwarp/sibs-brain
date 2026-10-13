# sibs-brain

Uma wiki que se escreve sozinha a partir dos tweets de [@sseraphini](https://x.com/sseraphini).

Todo dia, o sibs-brain lê os posts novos da conta [@sseraphini](https://x.com/sseraphini) no X, decide
sobre o que cada um fala e se vale a pena guardar, e organiza tudo em categorias. O resultado é um site
onde dá para navegar por assunto pelas ideias publicadas ali e também fazer perguntas em linguagem
natural, com respostas que citam os posts originais.

> Projeto pessoal. O código está aqui para consulta e referência, por isso não há instruções de
> instalação.

A história do projeto e mais detalhes estão em
[julianogrendene.com/projects/sibs-brain](https://www.julianogrendene.com/projects/sibs-brain).

## O que o site oferece

- **Categorias.** Os posts agrupados por tema (Tecnologia, Negócios, Ideias...), do mais recente para o
  mais antigo, com link para o post original no X.
- **Perguntas.** Na página inicial, qualquer pessoa pergunta algo como "o que @sseraphini pensa
  sobre performance de frontend?" e recebe uma resposta curta, baseada só nos posts, com as fontes citadas.
- **Painel do dono.** Uma área restrita para revisar os casos em que a classificação ficou em dúvida,
  editar páginas à mão e acompanhar o gasto do mês.

## Fluxo básico

1. Uma vez por dia, a pipeline busca os posts novos.
2. Cada post é classificado por tema e por relevância.
3. Os relevantes são publicados na categoria certa; os irrelevantes são descartados.
4. O site é atualizado, e os posts novos passam a valer também para as perguntas.

## A pipeline

A pipeline é uma sequência de etapas que roda automaticamente uma vez por dia. Cada etapa faz uma coisa
só e entrega o resultado para a próxima.

### 1. Coleta

Busca no X os posts publicados desde a última execução. Com o orçamento que sobrar, continua voltando
no histórico. Retweets e respostas ficam de fora.

### 2. Montagem das threads

Posts da mesma conversa viram uma única thread. É a thread, e não cada post solto, que é classificada
e publicada. Se uma thread ganha um post novo, ela volta para a fila de classificação.

### 3. Classificação

É o coração do projeto. Para economizar sem perder qualidade, a decisão passa por até três níveis:

- **Classificador rápido.** Um modelo barato responde três perguntas: qual o tema, que tipo de conteúdo
  é (opinião, notícia, indicação...) e se vale registrar. Junto com cada resposta, ele diz o quanto está
  confiante.
- **Modelo de linguagem.** Só é chamado quando o classificador fica em dúvida. Ele revisa a sugestão e
  aprova, corrige ou admite que também não sabe. Também é ele quem propõe um tema novo quando nenhum
  dos existentes serve.
- **Revisão manual.** O que nenhum dos dois conseguiu decidir vai para o painel do dono.

Assim, a maior parte dos posts é resolvida pelo modelo barato, e o modelo mais caro fica reservado para
os casos difíceis.

### 4. Páginas da wiki

Cada tema com posts publicados vira uma página. Se o dono editou uma página à mão, ela nunca é
sobrescrita: os posts novos aparecem como sugestão no painel.

### 5. Índice de busca

Cada thread publicada vira um vetor numérico que representa o seu significado. É isso que permite
encontrar posts parecidos com uma pergunta, mesmo quando as palavras não são as mesmas.

### 6. Atualização do site

As páginas da wiki ficam prontas de antemão e são servidas direto da CDN. Ao fim da pipeline, o site é
avisado e passa a mostrar a versão nova.

## Como as perguntas são respondidas

A pergunta vira um vetor, da mesma forma que os posts no índice de busca. O sistema encontra os 8 posts
de significado mais parecido e entrega só esses para um modelo de linguagem, que escreve uma resposta
curta citando cada post que usou.

O modelo é instruído a responder apenas com base nos posts encontrados e a dizer quando não achou nada
sobre o assunto, em vez de inventar.

## Proteções

- **Orçamento fixo por mês.** Cada serviço pago (X, modelos de linguagem, busca) tem um teto. Antes de
  cada chamada, o custo máximo é reservado; se não couber, a chamada não acontece. A conta nunca passa
  do limite.
- **Limite de perguntas.** Cada visitante pode fazer algumas perguntas por hora, e o site todo tem um
  teto por hora, o que impede que um ataque gaste o orçamento do mês de uma vez.
- **Privacidade.** O endereço IP dos visitantes nunca é guardado, só uma versão embaralhada dele, usada
  para contar as perguntas.

## Organização do código

O projeto é um monorepo: cada parte da pipeline é um pacote separado, com uma responsabilidade só.

| Pacote | Responsabilidade |
|---|---|
| `apps/web` | O site: wiki, perguntas e painel do dono |
| `apps/worker` | Encadeia as etapas da pipeline |
| `packages/x-source` | Conversa com a API do X |
| `packages/classifier` | Classificador rápido |
| `packages/validator` | Revisão pelo modelo de linguagem |
| `packages/wiki-engine` | Monta as threads e as páginas |
| `packages/ask` | Busca por significado e respostas às perguntas |
| `packages/db` | Todo o acesso ao banco, com as regras de negócio num lugar só |
| `packages/core` | Tipos, validação e configuração compartilhados |

**Tecnologias:** TypeScript, Next.js, MongoDB, Turborepo, OpenAI e Vercel.

## Licença

[MIT](LICENSE)
