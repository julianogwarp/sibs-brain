import { z } from "zod";

export const TopicSchema = z.object({
  _id: z.string(), // slug
  name: z.string(),
  description: z.string(),
  threadIds: z.array(z.string()),
  updatedAt: z.coerce.date(),
});
export type Topic = z.infer<typeof TopicSchema>;

export const PageSchema = z.object({
  _id: z.string(), // slug
  title: z.string(),
  body: z.string(), // markdown
  topicId: z.string(),
  sourceThreadIds: z.array(z.string()),
  links: z.array(z.string()), // slugs de outras páginas
  editedManually: z.boolean(), // o worker não sobrescreve se true
  revision: z.number().int(),
  updatedAt: z.coerce.date(),
});
export type Page = z.infer<typeof PageSchema>;

export const RevisionSchema = z.object({
  pageId: z.string(),
  revision: z.number().int(),
  title: z.string(),
  body: z.string(),
  source: z.enum(["worker", "manual"]),
  createdAt: z.coerce.date(),
});
export type Revision = z.infer<typeof RevisionSchema>;

export const EmbeddingSchema = z.object({
  _id: z.string(), // threadId
  model: z.string(),
  textHash: z.string(), // detecta quando a thread mudou e precisa de um vetor novo
  vector: z.array(z.number()),
  updatedAt: z.coerce.date(),
});
export type Embedding = z.infer<typeof EmbeddingSchema>;

export const RateLimitSchema = z.object({
  _id: z.string(), // `${hash do visitante}:${hora}`
  count: z.number().int(),
  expiresAt: z.coerce.date(),
});
export type RateLimit = z.infer<typeof RateLimitSchema>;

export const PageSuggestionSchema = z.object({
  pageId: z.string(),
  threadIds: z.array(z.string()),
  createdAt: z.coerce.date(),
  resolved: z.boolean(),
});
export type PageSuggestion = z.infer<typeof PageSuggestionSchema>;
