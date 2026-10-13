import { ObjectId } from "mongodb";
import { isRemovedTopic, type Page, type PageSuggestion } from "@sibs/core";
import { collections } from "../client";

export type PageSummary = Pick<Page, "_id" | "title" | "sourceThreadIds" | "updatedAt">;

/** Páginas que aparecem no site: todas menos as de temas removidos. */
export async function publicPages(): Promise<PageSummary[]> {
  const { pages } = await collections();
  const list = await pages.find({}, { projection: { title: 1, sourceThreadIds: 1, updatedAt: 1 } }).toArray();
  return list.filter((p) => !isRemovedTopic(p._id, p.title));
}

/** A página pelo slug, ou null se não existe ou é de um tema removido. */
export async function publicPage(slug: string): Promise<Page | null> {
  const page = await getPage(slug);
  return page && !isRemovedTopic(page._id, page.title) ? page : null;
}

/** Sem filtro (o /admin edita qualquer página). */
export async function getPage(slug: string): Promise<Page | null> {
  const { pages } = await collections();
  return pages.findOne({ _id: slug });
}

/** Página montada pelo worker, com a revisão correspondente. */
export async function saveGeneratedPage(page: Page): Promise<void> {
  const c = await collections();
  await c.pages.replaceOne({ _id: page._id }, page, { upsert: true });
  await c.revisions.insertOne({ pageId: page._id, revision: page.revision, title: page.title, body: page.body, source: "worker", createdAt: page.updatedAt });
}

/** Edição do /admin: vira uma revisão nova e o worker para de sobrescrever a página. */
export async function saveManualEdit(slug: string, { title, body }: { title: string; body: string }): Promise<boolean> {
  const c = await collections();
  const page = await c.pages.findOne({ _id: slug });
  if (!page) return false;
  const revision = page.revision + 1;
  const now = new Date();
  await c.pages.updateOne({ _id: slug }, { $set: { title, body, editedManually: true, revision, updatedAt: now } });
  await c.revisions.insertOne({ pageId: slug, revision, title, body, source: "manual", createdAt: now });
  return true;
}

/** Posts novos para uma página editada à mão: ficam como sugestão no /admin. */
export async function addSuggestion(pageId: string, threadIds: string[]): Promise<void> {
  const { suggestions } = await collections();
  await suggestions.insertOne({ pageId, threadIds, createdAt: new Date(), resolved: false });
}

export async function pendingSuggestions(): Promise<(PageSuggestion & { _id: ObjectId })[]> {
  const { suggestions } = await collections();
  return suggestions.find({ resolved: false }).sort({ createdAt: 1 }).toArray();
}

export async function resolveSuggestion(id: string): Promise<void> {
  const { suggestions } = await collections();
  await suggestions.updateOne({ _id: new ObjectId(id) }, { $set: { resolved: true } });
}
