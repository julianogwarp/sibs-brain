import { notFound } from "next/navigation";
import { publicPages } from "@sibs/db";
import { CategoryNav } from "@/components/wiki/category-nav";
import { PostGrid } from "@/components/wiki/post-grid";
import { PostsPagination } from "@/components/wiki/posts-pagination";
import { getCategories, loadOrDefer, loadPosts, dateSpanLabel, rangeLabel, WIDE } from "@/lib/wiki";

/** Todos os posts publicados, de todas as categorias (/wiki e /wiki/pagina/N). */
export async function AllPosts({ page }: { page: number }) {
  const { threadIds, categories, loaded } = await loadOrDefer(page === 1 ? "/wiki" : `/wiki/pagina/${page}`, async () => {
    const threadIds = [...new Set((await publicPages()).flatMap((p) => p.sourceThreadIds))];
    const [categories, loaded] = await Promise.all([getCategories(), loadPosts(threadIds, page)]);
    return { threadIds, categories, loaded };
  });
  if (loaded.page !== page) notFound();

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
        footer={<PostsPagination page={loaded.page} pages={loaded.pages} />}
      />
    </article>
  );
}
