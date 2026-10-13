/** Estimativa conservadora de tokens (~3 caracteres por token). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 3);
