import { z } from "zod";

export const TWEET_KINDS = ["opinion", "insight", "news", "reference", "personal", "conversation", "other"] as const;
export const TweetKindSchema = z.enum(TWEET_KINDS);
export type TweetKind = z.infer<typeof TweetKindSchema>;

export const ClassificationStatusSchema = z.enum([
  "published", // confiança alta ou aprovado pela LLM
  "pending_validation", // aguardando a LLM
  "needs_review", // vai para a fila do /admin
  "rejected", // irrelevante para a wiki
]);
export type ClassificationStatus = z.infer<typeof ClassificationStatusSchema>;

export const JevResultSchema = z.object({
  topic: z.string(), // slug do tema
  kind: TweetKindSchema,
  relevant: z.boolean(),
  confidence: z.number().min(0).max(1), // menor confiança entre tema e relevância
  relevantConfidence: z.number().min(0).max(1).optional(), // só da pergunta "é relevante?"
});
export type JevResult = z.infer<typeof JevResultSchema>;

export const ValidatorVerdictSchema = z.object({
  verdict: z.enum(["approved", "corrected", "uncertain"]),
  topic: z.string(),
  kind: TweetKindSchema,
  relevant: z.boolean(),
  reasoning: z.string(),
  model: z.string(),
});
export type ValidatorVerdict = z.infer<typeof ValidatorVerdictSchema>;

export const ClassificationSchema = z.object({
  _id: z.string(), // threadId
  jev: JevResultSchema,
  validation: ValidatorVerdictSchema.nullable(),
  status: ClassificationStatusSchema,
  // Subcategoria (só em categorias que têm); undefined = ainda não classificado, "outros" = nenhuma serviu
  subtopic: z.object({ topic: z.string(), slug: z.string(), confidence: z.number() }).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Classification = z.infer<typeof ClassificationSchema>;

/** Resultado final, depois da validação (se houve). */
export function finalLabels(c: Classification): { topic: string; kind: TweetKind; relevant: boolean } {
  const source = c.validation && c.validation.verdict !== "uncertain" ? c.validation : c.jev;
  return { topic: source.topic, kind: source.kind, relevant: source.relevant };
}
