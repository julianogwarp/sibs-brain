import { notFound, redirect } from "next/navigation";
import Markdown from "react-markdown";
import { isRemovedTopic } from "@sibs/core";
import { collections } from "@sibs/db";
import { CategoryNav } from "@/components/wiki/category-nav";
import { PostGrid } from "@/components/wiki/post-grid";
import { PostsPagination } from "@/components/wiki/posts-pagination";
import { SubcategoryNav } from "@/components/wiki/subcategory-nav";
import { getCategories, getSubcategories, loadPosts, dateSpanLabel, parsePageSegment, rangeLabel, wikiHref, WIDE } from "@/lib/wiki";

// Gerada na primeira visita e servida pronta depois (ISR); o Cron e o /admin invalidam quando os dados mudam
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

/**
 * Categoria, com subcategoria e página no caminho:
 * /wiki/tecnologia, /wiki/tecnologia/2, /wiki/tecnologia/frontend, /wiki/tecnologia/frontend/2.
 */
export default async function WikiPage({ params }: { params: Promise<{ slug: string; rest?: string[] }> }) {
  const { slug, rest = [] } = await params;
  const { pages } = await collections();
  const page = await pages.findOne({ _id: slug });
  if (!page || isRemovedTopic(page._id, page.title)) notFound();

  // Subcategorias (só nas categorias que têm): filtram os posts da grade
  const subcategories = await getSubcategories(page.topicId, page.sourceThreadIds);
  const { sub, requestedPage } = parseRest(rest, subcategories?.items.map((s) => s.slug) ?? []);
  if (requestedPage === 1 && rest.at(-1) === "1") redirect(wikiHref({ topic: slug, sub }));
  const threadIds = sub ? page.sourceThreadIds.filter((id) => subcategories!.byThread.get(id) === sub) : page.sourceThreadIds;

  const [categories, loaded] = await Promise.all([getCategories(), loadPosts(threadIds, requestedPage)]);
  if (loaded.page !== requestedPage) notFound();

  return (
    <article style={WIDE}>
      <CategoryNav categories={categories} active={slug} />
      {subcategories && subcategories.items.length > 0 && (
        <SubcategoryNav topic={slug} items={subcategories.items} active={sub} total={page.sourceThreadIds.length} />
      )}
      {/* Texto escrito à mão no /admin continua aparecendo */}
      {page.editedManually && (
        <div className="prose-wiki">
          <Markdown>{page.body}</Markdown>
        </div>
      )}
      <PostGrid
        posts={loaded.posts}
        subtitle={[rangeLabel(loaded), dateSpanLabel(loaded)].filter(Boolean).join(" · ")}
        footer={<PostsPagination topic={slug} sub={sub} page={loaded.page} pages={loaded.pages} />}
      />
    </article>
  );
}

/** [] · [página] · [sub] · [sub, página]; qualquer outra coisa é 404. "1" vale como página 1. */
function parseRest(rest: string[], subs: string[]): { sub: string | null; requestedPage: number } {
  const pageOf = (raw: string) => (raw === "1" ? 1 : parsePageSegment(raw));
  if (rest.length === 0) return { sub: null, requestedPage: 1 };
  if (rest.length === 1) {
    const page = pageOf(rest[0]!);
    if (page) return { sub: null, requestedPage: page };
    if (subs.includes(rest[0]!)) return { sub: rest[0]!, requestedPage: 1 };
  }
  if (rest.length === 2 && subs.includes(rest[0]!)) {
    const page = pageOf(rest[1]!);
    if (page) return { sub: rest[0]!, requestedPage: page };
  }
  notFound();
}
