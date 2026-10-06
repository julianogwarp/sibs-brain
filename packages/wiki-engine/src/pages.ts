import { finalLabels, isRemovedTopic, type Page, type Thread } from "@sibs/core";
import { collections } from "@sibs/db";

const tweetUrl = (username: string, id: string) => `https://x.com/${username}/status/${id}`;

/**
 * Recria a página de um tema a partir das threads publicadas.
 * Se você editou a página à mão, não sobrescreve: registra uma sugestão para o /admin.
 */
export async function rebuildTopicPage(topicId: string, username: string): Promise<"updated" | "suggested" | "skipped"> {
  const c = await collections();
  const topic = await c.topics.findOne({ _id: topicId });
  if (!topic || isRemovedTopic(topic._id, topic.name)) return "skipped";

  const published = await c.classifications.find({ status: "published" }).toArray();
  const threadIds = published
    .filter((cl) => {
      const labels = finalLabels(cl);
      return labels.relevant && labels.topic === topicId;
    })
    .map((cl) => cl._id);
  if (threadIds.length === 0) return "skipped";

  const threads = await c.threads.find({ _id: { $in: threadIds } }).sort({ startedAt: -1 }).toArray();
  const existing = await c.pages.findOne({ _id: topicId });

  if (existing?.editedManually) {
    const newIds = threadIds.filter((id) => !existing.sourceThreadIds.includes(id));
    if (newIds.length > 0) {
      await c.suggestions.insertOne({ pageId: topicId, threadIds: newIds, createdAt: new Date(), resolved: false });
      return "suggested";
    }
    return "skipped";
  }

  const page: Page = {
    _id: topicId,
    title: topic.name,
    body: renderBody(topic.description, threads, username),
    topicId,
    sourceThreadIds: threadIds,
    links: [],
    editedManually: false,
    revision: (existing?.revision ?? 0) + 1,
    updatedAt: new Date(),
  };
  await c.pages.replaceOne({ _id: topicId }, page, { upsert: true });
  await c.revisions.insertOne({
    pageId: topicId,
    revision: page.revision,
    title: page.title,
    body: page.body,
    source: "worker",
    createdAt: page.updatedAt,
  });
  return "updated";
}

function renderBody(description: string, threads: Thread[], username: string): string {
  const sections = threads.map((t) => {
    const date = t.startedAt.toISOString().slice(0, 10);
    const quote = t.text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    return `### ${date}\n\n${quote}\n\n[ver no X](${tweetUrl(username, t.tweetIds[0]!)})`;
  });
  return [description, ...sections].filter(Boolean).join("\n\n");
}
