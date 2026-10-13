import { env, type IngestionRun } from "@sibs/core";
import { BudgetExceededError, collections } from "@sibs/db";
import { configFromEnv, XSource } from "@sibs/x-source";

interface IngestResult {
  fetched: number;
  conversationIds: string[];
  stoppedReason: NonNullable<IngestionRun["stoppedReason"]>;
}

/**
 * 1) Busca tudo que é mais novo que o último tweet salvo.
 * 2) Com o orçamento que sobrar, continua baixando o histórico para trás.
 */
export async function ingest(username: string): Promise<IngestResult> {
  const c = await collections();
  const x = new XSource(configFromEnv());

  const newest = await c.tweets.find().sort({ createdAt: -1 }).limit(1).next();
  const oldest = await c.tweets.find().sort({ createdAt: 1 }).limit(1).next();

  const run: IngestionRun = {
    startedAt: new Date(),
    finishedAt: null,
    sinceId: newest?._id ?? null,
    newestId: null,
    oldestId: null,
    fetched: 0,
    stoppedReason: null,
    error: null,
  };
  const { insertedId } = await c.ingestionRuns.insertOne(run);
  const conversationIds = new Set<string>();

  // Data mais antiga a coletar (ex.: 2026-01-01). Sem ela, vai até onde a X permitir.
  const startDate = env().X_START_DATE ?? null;

  /** Salva os tweets da página. Retorna false quando passou da data de início (parar de paginar). */
  const save = async (tweets: Awaited<ReturnType<XSource["fetchTimelinePage"]>>["tweets"]): Promise<boolean> => {
    const inRange = startDate ? tweets.filter((t) => t.createdAt >= startDate) : tweets;
    for (const t of inRange) {
      await c.tweets.replaceOne({ _id: t._id }, t, { upsert: true });
      conversationIds.add(t.conversationId);
    }
    run.fetched += inRange.length;
    return inRange.length === tweets.length;
  };

  try {
    const userId = await x.getUserId(username);

    // 1) Novos
    let token: string | undefined;
    do {
      const page = await x.fetchTimelinePage(userId, { sinceId: newest?._id, paginationToken: token });
      const keepGoing = await save(page.tweets);
      run.newestId ??= page.meta.newest_id ?? null;
      token = keepGoing ? page.meta.next_token : undefined;
      logPage("novos", page.tweets, keepGoing, token);
    } while (token);

    // 2) Histórico (só se já existe algo salvo; na primeira execução o passo 1 já vai para trás).
    // Se o mais antigo salvo já é anterior à data de início, não há o que buscar.
    if (oldest && !(startDate && oldest.createdAt <= startDate)) {
      token = undefined;
      do {
        const page = await x.fetchTimelinePage(userId, { untilId: oldest._id, paginationToken: token });
        const keepGoing = await save(page.tweets);
        run.oldestId = page.meta.oldest_id ?? run.oldestId;
        token = keepGoing ? page.meta.next_token : undefined;
        logPage("histórico", page.tweets, keepGoing, token);
      } while (token);
    }

    run.stoppedReason = "done";
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      run.stoppedReason = "budget";
      run.error = err.message;
    } else {
      run.stoppedReason = "error";
      run.error = err instanceof Error ? err.message : String(err);
      console.error(err);
    }
  }

  run.finishedAt = new Date();
  await c.ingestionRuns.replaceOne({ _id: insertedId }, run);

  return { fetched: run.fetched, conversationIds: [...conversationIds], stoppedReason: run.stoppedReason };
}

function logPage(step: string, tweets: { createdAt: Date }[], keepGoing: boolean, token: string | undefined) {
  const oldest = tweets.at(-1)?.createdAt.toISOString().slice(0, 10) ?? "—";
  const next = token ? "próxima página" : keepGoing ? "a X não tem mais" : "chegou na X_START_DATE";
  console.log(`  [${step}] ${tweets.length} tweets, mais antigo ${oldest} → ${next}`);
}
