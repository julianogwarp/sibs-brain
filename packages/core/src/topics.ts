/**
 * Temas que não queremos mais. O worker apaga página, tema e revisões e devolve os posts
 * deles para a fila de classificação; se a LLM insistir num deles, o post é rejeitado.
 * A web também esconde esses temas, mesmo que ainda existam no banco.
 */
export const REMOVED_TOPICS: string[] = ["vida", "vida-pessoal"];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** true se o slug (ou o nome, ex.: "Vida Pessoal") é de um tema removido. */
export function isRemovedTopic(slug: string, name?: string | null): boolean {
  return [slug, name].some((s) => !!s && REMOVED_TOPICS.includes(normalize(s)));
}
