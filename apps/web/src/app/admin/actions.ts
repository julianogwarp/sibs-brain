"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { publishManually, rejectThread, resolveSuggestion as markSuggestionResolved, saveManualEdit } from "@sibs/db";
import { destroySession, requireAdmin } from "@/lib/session";
import { revalidateWiki } from "@/lib/wiki";

export async function savePage(slug: string, formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  if (!title || !(await saveManualEdit(slug, { title, body }))) return;
  revalidateWiki(); // o título aparece nas pílulas de todas as páginas
  redirect(`/wiki/${slug}`);
}

/** Decide um item da fila: publica em um tema ou rejeita. */
export async function resolveReview(threadId: string, formData: FormData) {
  await requireAdmin();
  const decision = String(formData.get("decision"));
  const topic = String(formData.get("topic") ?? "");
  // Tema removido não publica: o post é rejeitado, como no worker
  const published = decision === "publish" && topic !== "" && (await publishManually(threadId, topic));
  if (!published) await rejectThread(threadId);
  revalidatePath("/admin");
}

export async function resolveSuggestion(id: string) {
  await requireAdmin();
  await markSuggestionResolved(id);
  revalidatePath("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
