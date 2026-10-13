import { purgeRemovedTopics } from "@sibs/db";

/** Apaga os temas removidos e devolve os posts deles para a fila de classificação. */
export async function removeTopics(): Promise<void> {
  const r = await purgeRemovedTopics();
  if (r.pages + r.classifications > 0 || r.topics.length > 0) {
    console.log(
      `[temas removidos] ${r.topics.join(", ") || "-"}: ${r.pages} página(s), ${r.revisions} revisão(ões), ` +
        `${r.suggestions} sugestão(ões) apagadas; ${r.classifications} post(s) voltam para a classificação`,
    );
  }
}
