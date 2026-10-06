import { z } from "zod";

export const UsageServiceSchema = z.enum(["x", "llm", "jev", "embed", "chat"]);
export type UsageService = z.infer<typeof UsageServiceSchema>;

export const UsageSchema = z.object({
  _id: z.string(), // `${service}:${YYYY-MM}`
  service: UsageServiceSchema,
  month: z.string(), // YYYY-MM
  spentBrl: z.number(),
  calls: z.number().int(),
  updatedAt: z.coerce.date(),
});
export type Usage = z.infer<typeof UsageSchema>;

export const IngestionRunSchema = z.object({
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date().nullable(),
  sinceId: z.string().nullable(),
  newestId: z.string().nullable(),
  oldestId: z.string().nullable(), // para continuar o histórico
  fetched: z.number().int(),
  stoppedReason: z.enum(["done", "budget", "error"]).nullable(),
  error: z.string().nullable(),
});
export type IngestionRun = z.infer<typeof IngestionRunSchema>;

export function currentMonth(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}
