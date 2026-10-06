import { finalLabels, isRemovedTopic } from "@sibs/core";
import { collections } from "@sibs/db";

/** Apaga os temas removidos e devolve os posts deles para a fila de classificação. */
export async function removeTopics(): Promise<void> {
  const c = await collections();

  // Pelo slug ou pelo nome: a LLM pode ter criado o tema com outro slug (ex.: "Vida Pessoal")
  const [topicDocs, pageDocs] = await Promise.all([
    c.topics.find({}, { projection: { name: 1 } }).toArray(),
    c.pages.find({}, { projection: { title: 1 } }).toArray(),
  ]);
  const removed = [
    ...new Set([
      ...topicDocs.filter((t) => isRemovedTopic(t._id, t.name)).map((t) => t._id),
      ...pageDocs.filter((p) => isRemovedTopic(p._id, p.title)).map((p) => p._id),
    ]),
  ];
  const isRemoved = (slug: string) => removed.includes(slug) || isRemovedTopic(slug);

  // Classificações que apontam para um tema removido (pelo jev ou pela LLM) são apagadas:
  // sem classificação, a thread volta para a fila e é classificada entre os temas que restam.
  // As já rejeitadas ficam como estão, senão voltariam para a fila a cada execução
  const affected = (await c.classifications.find({ status: { $ne: "rejected" } }).toArray()).filter(
    (cl) => isRemoved(finalLabels(cl).topic) || isRemoved(cl.jev.topic),
  );
  const ids = affected.map((cl) => cl._id);

  const [pages, topics, revisions, suggestions, classifications] = await Promise.all([
    c.pages.deleteMany({ _id: { $in: removed } }),
    c.topics.deleteMany({ _id: { $in: removed } }),
    c.revisions.deleteMany({ pageId: { $in: removed } }),
    c.suggestions.deleteMany({ pageId: { $in: removed } }),
    ids.length ? c.classifications.deleteMany({ _id: { $in: ids } }) : Promise.resolve({ deletedCount: 0 }),
  ]);
  if (pages.deletedCount + topics.deletedCount + classifications.deletedCount > 0) {
    console.log(
      `[temas removidos] ${removed.join(", ") || "-"}: ${pages.deletedCount} página(s), ${revisions.deletedCount} revisão(ões), ` +
        `${suggestions.deletedCount} sugestão(ões) apagadas; ${classifications.deletedCount} post(s) voltam para a classificação`,
    );
  }
}
