import { currentMonth, type UsageService } from "@sibs/core";
import { collections } from "./client";

export class BudgetExceededError extends Error {
  constructor(
    readonly service: UsageService,
    readonly spentBrl: number,
    readonly limitBrl: number,
  ) {
    super(`Limite de ${service} atingido: R$ ${spentBrl.toFixed(2)} de R$ ${limitBrl.toFixed(2)}`);
  }
}

export async function getMonthlySpend(service: UsageService, month = currentMonth()): Promise<number> {
  const { usage } = await collections();
  const doc = await usage.findOne({ _id: `${service}:${month}` });
  return doc?.spentBrl ?? 0;
}

/**
 * Reserva `costBrl` do orçamento do mês antes de uma chamada paga.
 * Atômico: só incrementa se o total continuar dentro do limite.
 */
export async function reserveBudget(service: UsageService, costBrl: number, limitBrl: number): Promise<void> {
  const { usage } = await collections();
  const month = currentMonth();
  const _id = `${service}:${month}`;

  await usage.updateOne(
    { _id },
    { $setOnInsert: { service, month, spentBrl: 0, calls: 0, updatedAt: new Date() } },
    { upsert: true },
  );

  const res = await usage.updateOne(
    { _id, spentBrl: { $lte: limitBrl - costBrl } },
    { $inc: { spentBrl: costBrl, calls: 1 }, $set: { updatedAt: new Date() } },
  );

  if (res.modifiedCount === 0) {
    throw new BudgetExceededError(service, await getMonthlySpend(service, month), limitBrl);
  }
}

/** Ajusta a reserva depois que o custo real é conhecido (pode ser negativo). */
export async function adjustSpend(service: UsageService, deltaBrl: number, opts: { countCall?: boolean } = {}): Promise<void> {
  if (deltaBrl === 0 && !opts.countCall) return;
  const { usage } = await collections();
  const month = currentMonth();
  await usage.updateOne(
    { _id: `${service}:${month}` },
    {
      $inc: { spentBrl: deltaBrl, calls: opts.countCall ? 1 : 0 },
      $set: { updatedAt: new Date() },
      $setOnInsert: { service, month },
    },
    { upsert: true },
  );
}
