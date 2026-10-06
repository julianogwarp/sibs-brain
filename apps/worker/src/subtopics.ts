import { finalLabels, OTHER_SUBTOPIC, SUBTOPICS, type Classification } from "@sibs/core";
import { Classifier } from "@sibs/classifier";
import { BudgetExceededError, collections } from "@sibs/db";

const MAX_CONSECUTIVE_FAILURES = 3;

/** Precisa (re)classificar: nunca foi, mudou de categoria, ou a subcategoria saiu da configuração. */
function needsSubtopic(c: Classification): string | null {
  const { topic, relevant } = finalLabels(c);
  const subs = SUBTOPICS[topic];
  if (!relevant || !subs) return null;
  const s = c.subtopic;
  if (!s || s.topic !== topic || (s.slug !== OTHER_SUBTOPIC && !(s.slug in subs))) return topic;
  return null;
}

/** Classifica com o jev a subcategoria dos posts publicados em categorias que têm subcategorias. */
export async function classifySubtopics(deadline = Infinity): Promise<void> {
  const c = await collections();
  const classifier = new Classifier();

  const pending = (await c.classifications.find({ status: "published" }).toArray())
    .map((cl) => ({ cl, topic: needsSubtopic(cl) }))
    .filter((x): x is { cl: Classification; topic: string } => x.topic !== null);
  if (pending.length === 0) return;
  console.log(`[subcategorias] ${pending.length} posts para classificar`);

  const threads = new Map((await c.threads.find({ _id: { $in: pending.map((p) => p.cl._id) } }).toArray()).map((t) => [t._id, t]));
  const counts = new Map<string, number>();
  let failures = 0;

  for (const { cl, topic } of pending) {
    if (Date.now() > deadline) {
      console.warn("[subcategorias] prazo da execução atingido; o resto fica para a próxima");
      break;
    }
    const thread = threads.get(cl._id);
    if (!thread) continue;
    try {
      const { slug, confidence } = await classifier.classifySubtopic(thread, SUBTOPICS[topic]!);
      await c.classifications.updateOne({ _id: cl._id }, { $set: { subtopic: { topic, slug, confidence } } });
      counts.set(`${topic}/${slug}`, (counts.get(`${topic}/${slug}`) ?? 0) + 1);
      failures = 0;
    } catch (err) {
      if (err instanceof BudgetExceededError) throw err;
      failures++;
      console.warn(`  erro no jev: ${err instanceof Error ? err.message : err} (fica para a próxima execução)`);
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn(`[subcategorias] jev falhou ${failures}x seguidas; o resto fica para a próxima execução`);
        break;
      }
    }
  }
  const summary = [...counts].sort().map(([k, n]) => `${k}: ${n}`).join(", ");
  if (summary) console.log(`[subcategorias] ${summary}`);
}
