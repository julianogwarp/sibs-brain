import { collections } from "@sibs/db";
import { CategoryNav } from "@/components/wiki/category-nav";
import { PostGrid } from "@/components/wiki/post-grid";
import { PostsPagination } from "@/components/wiki/posts-pagination";
import { getCategories, loadPosts, dateSpanLabel, parsePage, rangeLabel, WIDE } from "@/lib/wiki";

export const dynamic = "force-dynamic";

/** Todos os posts publicados, de todas as categorias. */
export default async function AllPosts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const page = parsePage(await searchParams);
  const { pages } = await collections();
  const allPages = await pages.find({}, { projection: { sourceThreadIds: 1 } }).toArray();
  const threadIds = [...new Set(allPages.flatMap((p) => p.sourceThreadIds))];
  const [categories, loaded] = await Promise.all([getCategories(), loadPosts(threadIds, page)]);

  return (
    <article style={WIDE}>
      <CategoryNav categories={categories} active={null} />
      <h1>Todos os posts</h1>
      <p className="muted">
        {threadIds.length} {threadIds.length === 1 ? "post" : "posts"} em {categories.length} {categories.length === 1 ? "categoria" : "categorias"}
      </p>
      <PostGrid
        posts={loaded.posts}
        subtitle={[rangeLabel(loaded), dateSpanLabel(loaded)].filter(Boolean).join(" · ")}
        footer={<PostsPagination base="/wiki" page={loaded.page} pages={loaded.pages} />}
      />
    </article>
  );
}
