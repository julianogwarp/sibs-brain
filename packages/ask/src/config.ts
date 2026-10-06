const num = (name: string, fallback: number) => Number(process.env[name] ?? fallback);

export const config = {
  usdBrl: () => num("USD_BRL", 5.5),
  embedModel: () => process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  embedUsdPerMtok: () => num("EMBEDDING_USD_PER_MTOK", 0.02),
  embedBudgetBrl: () => num("EMBED_MONTHLY_BUDGET_BRL", 5),
  chatModel: () => process.env.CHAT_MODEL ?? "gpt-6-luna",
  chatUsdPerMtokInput: () => num("CHAT_USD_PER_MTOK_INPUT", 0.1),
  chatUsdPerMtokOutput: () => num("CHAT_USD_PER_MTOK_OUTPUT", 0.5),
  chatBudgetBrl: () => num("CHAT_MONTHLY_BUDGET_BRL", 10),
  chatMaxPerHour: () => num("CHAT_MAX_PER_HOUR", 10),
};

/** Estimativa conservadora de tokens (~3 caracteres por token). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 3);
