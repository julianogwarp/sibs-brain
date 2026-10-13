import { isRemovedTopic, type Page, type Thread } from "@sibs/core";
import { addSuggestion, getPage, getThreads, getTopic, publishedThreadIds, saveGeneratedPage } from "@sibs/db";

const tweetUrl = (username: string, id: string) => `https://x.com/${username}/status/${id}`;

/**
 * Recria a página de um tema a partir das threads publicadas.
 * Se você editou a página à mão, não sobrescreve: registra uma sugestão para o /admin.
 */
export async function rebuildTopicPage(topicId: string, username: string): Promise<"updated" | "suggested" | "skipped"> {
  const topic = await getTopic(topicId);
  if (!topic || isRemovedTopic(topic._id, topic.name)) return "skipped";

  const threadIds = await publishedThreadIds(topicId);
  if (threadIds.length === 0) return "skipped";

  const threads = await getThreads(threadIds);
  const existing = await getPage(topicId);

  if (existing?.editedManually) {
    const newIds = threadIds.filter((id) => !existing.sourceThreadIds.includes(id));
    if (newIds.length > 0) {
      await addSuggestion(topicId, newIds);
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
  await saveGeneratedPage(page);
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
