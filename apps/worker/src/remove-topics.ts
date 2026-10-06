import { finalLabels } from "@sibs/core";
import { REMOVED_TOPICS } from "@sibs/classifier";
import { collections } from "@sibs/db";

/** Apaga os temas removidos e devolve os posts deles para a fila de classificação. */
export async function removeTopics(): Promise<void> {
  if (REMOVED_TOPICS.length === 0) return;
  const c = await collections();

  // Classificações que apontam para um tema removido (pelo jev ou pela LLM) são apagadas:
  // sem classificação, a thread volta para a fila e é classificada entre os temas que restam
  const affected = (await c.classifications.find().toArray()).filter(
    (cl) => REMOVED_TOPICS.includes(finalLabels(cl).topic) || REMOVED_TOPICS.includes(cl.jev.topic),
  );
  const ids = affected.map((cl) => cl._id);

  const [pages, topics, revisions, suggestions, classifications] = await Promise.all([
    c.pages.deleteMany({ _id: { $in: REMOVED_TOPICS } }),
    c.topics.deleteMany({ _id: { $in: REMOVED_TOPICS } }),
    c.revisions.deleteMany({ pageId: { $in: REMOVED_TOPICS } }),
    c.suggestions.deleteMany({ pageId: { $in: REMOVED_TOPICS } }),
    ids.length ? c.classifications.deleteMany({ _id: { $in: ids } }) : Promise.resolve({ deletedCount: 0 }),
  ]);
  if (pages.deletedCount + topics.deletedCount + classifications.deletedCount > 0) {
    console.log(
      `[temas removidos] ${REMOVED_TOPICS.join(", ")}: ${pages.deletedCount} página(s), ${revisions.deletedCount} revisão(ões), ` +
        `${suggestions.deletedCount} sugestão(ões) apagadas; ${classifications.deletedCount} post(s) voltam para a classificação`,
    );
  }
}
