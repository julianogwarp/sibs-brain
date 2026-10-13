import { env, type Classification, type ClassificationStatus } from "@sibs/core";
import { Classifier, isRemovedTopic, NEW_TOPIC, SEED_TOPICS } from "@sibs/classifier";
import { BudgetExceededError, collections } from "@sibs/db";
import { Validator } from "@sibs/validator";
import { threadsToClassify } from "@sibs/wiki-engine";

const MAX_CONSECUTIVE_FAILURES = 3;

/** Classifica threads pendentes e devolve os temas cujas páginas precisam ser recriadas. */
/** `deadline` (ms epoch): para antes de estourar o tempo; o que faltar fica para a próxima execução. */
export async function classifyPending(deadline = Infinity): Promise<Set<string>> {
  const c = await collections();
  const classifier = new Classifier();
  const validator = new Validator();
  const touched = new Set<string>();
  const { CONFIDENCE_PUBLISH: PUBLISH, CONFIDENCE_VALIDATE: VALIDATE } = env();

  for (const [slug, { name, description }] of Object.entries(SEED_TOPICS)) {
    await c.topics.updateOne(
      { _id: slug },
      { $setOnInsert: { name, description, threadIds: [], updatedAt: new Date() } },
      { upsert: true },
    );
    // Temas criados antes tinham o slug como nome; corrige o tema e o título da página
    await c.topics.updateOne({ _id: slug, name: slug }, { $set: { name } });
    await c.pages.updateOne({ _id: slug, title: slug }, { $set: { title: name } });
  }

  let llmBudgetLeft = true;
  // Falhas seguidas (serviço fora do ar): para de tentar e deixa o resto para a próxima execução
  let consecutiveFailures = 0;

  const pending = await threadsToClassify();
  console.log(`[classificação] ${pending.length} threads para classificar`);

  for (const [i, thread] of pending.entries()) {
    if (Date.now() > deadline) {
      console.warn(`[classificação] prazo da execução atingido; ${pending.length - i} threads ficam para a próxima`);
      break;
    }
    // Temas removidos nunca são oferecidos ao jev nem à LLM
    const topics = Object.fromEntries(
      (await c.topics.find().toArray()).filter((t) => !isRemovedTopic(t._id, t.name)).map((t) => [t._id, t.description]),
    );

    let jev;
    try {
      jev = await classifier.classify(thread, topics);
    } catch (err) {
      if (skipAfterFailure("jev", i, err)) break;
      continue;
    }

    // Irrelevante com segurança: o tema não importa, rejeita sem LLM
    const surelyIrrelevant = !jev.relevant && (jev.relevantConfidence ?? jev.confidence) >= PUBLISH;
    const needsLlm = !surelyIrrelevant && (jev.confidence < PUBLISH || jev.topic === NEW_TOPIC);
    let status: ClassificationStatus;
    let validation: Classification["validation"] = null;

    if (!needsLlm) {
      status = jev.relevant ? "published" : "rejected";
    } else if (jev.confidence < VALIDATE || !llmBudgetLeft) {
      status = "needs_review";
    } else {
      try {
        console.log(`  ${i + 1}/${pending.length} jev em dúvida (${pct(jev.confidence)}), consultando a LLM...`);
        const v = await validator.validate(thread, jev, topics);
        // A LLM insistiu num tema removido (ex.: "vida-pessoal"): não cria o tema e rejeita o post
        const blocked = isRemovedTopic(v.topic, v.newTopic?.name);
        if (v.newTopic && !blocked) {
          await c.topics.updateOne(
            { _id: v.topic },
            { $setOnInsert: { name: v.newTopic.name, description: v.newTopic.description, threadIds: [], updatedAt: new Date() } },
            { upsert: true },
          );
        }
        validation = { verdict: v.verdict, topic: v.topic, kind: v.kind, relevant: v.relevant, reasoning: v.reasoning, model: v.model };
        status = blocked ? "rejected" : v.verdict === "uncertain" ? "needs_review" : v.relevant ? "published" : "rejected";
      } catch (err) {
        if (!(err instanceof BudgetExceededError)) {
          if (skipAfterFailure("LLM", i, err)) break;
          continue;
        }
        console.warn(`[validação] ${err.message}; o resto vai para a fila de revisão`);
        llmBudgetLeft = false;
        status = "needs_review";
      }
    }
    consecutiveFailures = 0;

    const now = new Date();
    await c.classifications.replaceOne(
      { _id: thread._id },
      { jev, validation, status, createdAt: now, updatedAt: now },
      { upsert: true },
    );

    const finalTopic = validation?.topic ?? jev.topic;
    console.log(`  ${i + 1}/${pending.length} ${status} · ${finalTopic} · jev ${pct(jev.confidence)}${validation ? ` · LLM: ${validation.verdict}` : ""}`);

    if (status === "published") {
      const topic = validation?.topic ?? jev.topic;
      await c.topics.updateOne({ _id: topic }, { $addToSet: { threadIds: thread._id }, $set: { updatedAt: now } });
      touched.add(topic);
    }
  }

  return touched;

  /** Registra a falha; a thread fica sem classificação e é tentada de novo na próxima execução. */
  function skipAfterFailure(service: string, i: number, err: unknown): boolean {
    consecutiveFailures++;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ${i + 1}/${pending.length} erro no ${service}: ${msg} (fica para a próxima execução)`);
    if (consecutiveFailures < MAX_CONSECUTIVE_FAILURES) return false;
    console.warn(`[classificação] ${service} falhou ${consecutiveFailures}x seguidas; parando. O que faltou será tentado na próxima execução.`);
    return true;
  }
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
