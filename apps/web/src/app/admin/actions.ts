"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRemovedTopic } from "@sibs/core";
import { collections } from "@sibs/db";
import { destroySession, requireAdmin } from "@/lib/session";

export async function savePage(slug: string, formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const c = await collections();
  const page = await c.pages.findOne({ _id: slug });
  if (!page || !title) return;

  const revision = page.revision + 1;
  const now = new Date();
  await c.pages.updateOne({ _id: slug }, { $set: { title, body, editedManually: true, revision, updatedAt: now } });
  await c.revisions.insertOne({ pageId: slug, revision, title, body, source: "manual", createdAt: now });
  revalidatePath(`/wiki/${slug}`);
  redirect(`/wiki/${slug}`);
}

/** Decide um item da fila: publica em um tema ou rejeita. */
export async function resolveReview(threadId: string, formData: FormData) {
  await requireAdmin();
  const decision = String(formData.get("decision"));
  const topic = String(formData.get("topic") ?? "");
  const c = await collections();
  const cls = await c.classifications.findOne({ _id: threadId });
  if (!cls) return;

  const now = new Date();
  if (decision === "publish" && topic && !isRemovedTopic(topic)) {
    await c.classifications.updateOne(
      { _id: threadId },
      {
        $set: {
          status: "published",
          validation: { verdict: "corrected", topic, kind: cls.validation?.kind ?? cls.jev.kind, relevant: true, reasoning: "Revisão manual", model: "manual" },
          updatedAt: now,
        },
      },
    );
    await c.topics.updateOne({ _id: topic }, { $addToSet: { threadIds: threadId }, $set: { updatedAt: now } });
  } else {
    await c.classifications.updateOne({ _id: threadId }, { $set: { status: "rejected", updatedAt: now } });
  }
  revalidatePath("/admin");
}

export async function resolveSuggestion(id: string) {
  await requireAdmin();
  const { ObjectId } = await import("mongodb");
  const c = await collections();
  await c.suggestions.updateOne({ _id: new ObjectId(id) }, { $set: { resolved: true } });
  revalidatePath("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
