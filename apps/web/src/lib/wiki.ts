import "server-only";
import { revalidatePath } from "next/cache";
import { collections } from "@sibs/db";
import { finalLabels, isRemovedTopic, OTHER_SUBTOPIC, SUBTOPICS, type Thread } from "@sibs/core";
import type { GridPost } from "@/components/wiki/post-grid";

// Páginas da wiki usam até 1280px, mais que os 768px do <main>; centralizado e com 24px de respiro nas bordas.
// Fica inline (e não no CSS global) para não depender do cache de CSS do servidor de desenvolvimento.
const WIDE_WIDTH = "min(1280px, 100vw - 48px)";
export const WIDE: React.CSSProperties = { width: WIDE_WIDTH, marginInline: `calc((100% - ${WIDE_WIDTH}) / 2)` };

export interface Category {
  slug: string;
  title: string;
  posts: number;
  updatedAt: string; // ISO
}

/** Todas as categorias (páginas), as com mais posts primeiro. Temas removidos ficam de fora. */
export async function getCategories(): Promise<Category[]> {
  const { pages } = await collections();
  const list = await pages.find({}, { projection: { title: 1, sourceThreadIds: 1, updatedAt: 1 } }).toArray();
  return list
    .filter((p) => !isRemovedTopic(p._id, p.title))
    .map((p) => ({ slug: p._id, title: p.title, posts: p.sourceThreadIds.length, updatedAt: p.updatedAt.toISOString() }))
    .sort((a, b) => b.posts - a.posts || a.title.localeCompare(b.title, "pt-BR"));
}

const TIME_ZONE = "America/Sao_Paulo";
const timeLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const fullDate = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" });


/** Fim da última coleta do worker (Cron diário), para mostrar na home. */
export async function lastUpdate(): Promise<string | null> {
  const { ingestionRuns } = await collections();
  const run = await ingestionRuns.find({ finishedAt: { $ne: null } }).sort({ startedAt: -1 }).limit(1).next();
  return run?.finishedAt?.toISOString() ?? null;
}

export const PAGE_SIZE = 10;

/**
 * Invalida todas as páginas públicas; a próxima visita a cada uma gera a versão nova.
 * As páginas são geradas uma vez e servidas prontas (ISR). O `revalidate = 3600` delas é só a rede de
 * segurança para quando o worker roda local (npm run worker) e não avisa o site.
 */
export function revalidateWiki(): void {
  revalidatePath("/", "layout");
}

/**
 * URL de uma listagem, só no caminho (sem query string) para poder ser pré-renderizada:
 * /wiki, /wiki/pagina/2, /wiki/tecnologia, /wiki/tecnologia/2, /wiki/tecnologia/frontend/2.
 */
export function wikiHref({ topic = null, sub = null, page = 1 }: { topic?: string | null; sub?: string | null; page?: number }): string {
  const pageSuffix = page > 1 ? `/${page}` : "";
  if (!topic) return page > 1 ? `/wiki/pagina/${page}` : "/wiki";
  return `/wiki/${topic}${sub ? `/${sub}` : ""}${pageSuffix}`;
}

/** Número de página do caminho: só inteiros a partir de 2 ("1" é a URL sem número). */
export function parsePageSegment(raw: string): number | null {
  return /^[1-9]\d*$/.test(raw) && raw !== "1" ? Number(raw) : null;
}

export interface Subcategory {
  slug: string;
  name: string;
  count: number;
}

/**
 * Subcategorias da categoria com a contagem de posts, e o mapa post → subcategoria.
 * Devolve null se a categoria não tem subcategorias. Posts ainda não classificados entram em "Outros".
 */
export async function getSubcategories(topic: string, threadIds: string[]) {
  const subs = SUBTOPICS[topic];
  if (!subs) return null;
  const { classifications } = await collections();
  const list = await classifications.find({ _id: { $in: threadIds } }).toArray();
  const byThread = new Map<string, string>();
  for (const id of threadIds) byThread.set(id, OTHER_SUBTOPIC);
  for (const c of list) {
    const s = c.subtopic;
    if (s && s.topic === finalLabels(c).topic && s.topic === topic && s.slug in subs) byThread.set(c._id, s.slug);
  }
  const counts = new Map<string, number>();
  for (const slug of byThread.values()) counts.set(slug, (counts.get(slug) ?? 0) + 1);

  // Ordem da configuração; "Outros" por último; só as que têm posts
  const items: Subcategory[] = Object.entries(subs)
    .map(([slug, s]) => ({ slug, name: s.name, count: counts.get(slug) ?? 0 }))
    .filter((s) => s.count > 0);
  const others = counts.get(OTHER_SUBTOPIC) ?? 0;
  if (others > 0) items.push({ slug: OTHER_SUBTOPIC, name: "Outros", count: others });
  return { items, byThread };
}

/** "21–40 de 58" para a página atual da grade. */
export function rangeLabel({ total, page }: Pick<LoadedPosts, "total" | "page">): string {
  if (total === 0) return "0 posts";
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return total <= PAGE_SIZE ? `${total} ${total === 1 ? "post" : "posts"}` : `${first}–${last} de ${total}`;
}

export interface LoadedPosts {
  posts: GridPost[]; // só a página atual
  oldest: Date | null; // data do post mais antigo da listagem (não só da página)
  newest: Date | null;
  total: number;
  page: number;
  pages: number;
}

/**
 * Threads (mais recentes primeiro) no formato da grade, no fuso da wiki, paginadas.
 */
export async function loadPosts(threadIds: string[], requestedPage = 1): Promise<LoadedPosts> {
  const { threads } = await collections();
  const list: Thread[] = await threads.find({ _id: { $in: threadIds } }).sort({ startedAt: -1 }).toArray();

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const username = process.env.X_USERNAME ?? "i";
  const tweetUrl = (t: Thread) => `https://x.com/${username}/status/${t.tweetIds[0]}`;

  const posts = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((t) => ({
    id: t._id,
    text: t.text,
    url: tweetUrl(t),
    when: `${fullDate.format(t.startedAt)}, ${timeLabel.format(t.startedAt)}`,
  }));
  return { posts, total, page, pages, oldest: list.at(-1)?.startedAt ?? null, newest: list[0]?.startedAt ?? null };
}

const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const yearOf = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, year: "numeric" }).format(d);

/** "de 2 de out. até 6 de out. de 2026" (o ano aparece uma vez quando é o mesmo). */
export function dateSpanLabel({ oldest, newest }: Pick<LoadedPosts, "oldest" | "newest">): string | null {
  if (!oldest || !newest) return null;
  const sameDay = dayMonth.format(oldest) === dayMonth.format(newest) && yearOf(oldest) === yearOf(newest);
  if (sameDay) return `em ${fullDate.format(newest)}`;
  const start = yearOf(oldest) === yearOf(newest) ? dayMonth.format(oldest) : fullDate.format(oldest);
  return `de ${start} até ${fullDate.format(newest)}`;
}
