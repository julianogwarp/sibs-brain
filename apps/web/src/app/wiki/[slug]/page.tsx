import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { isRemovedTopic } from "@sibs/core";
import { collections } from "@sibs/db";
import { CategoryNav } from "@/components/wiki/category-nav";
import { PostGrid } from "@/components/wiki/post-grid";
import { isAdmin } from "@/lib/session";
import { PostsPagination } from "@/components/wiki/posts-pagination";
import { SubcategoryNav } from "@/components/wiki/subcategory-nav";
import { getCategories, getSubcategories, loadPosts, dateSpanLabel, parsePage, parseSub, rangeLabel, WIDE } from "@/lib/wiki";

export const dynamic = "force-dynamic";

export default async function WikiPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const requestedPage = parsePage(query);
  const { pages } = await collections();
  const page = await pages.findOne({ _id: slug });
  if (!page || isRemovedTopic(page._id, page.title)) notFound();

  // Subcategorias (só nas categorias que têm): filtram os posts da grade e da timeline
  const subcategories = await getSubcategories(page.topicId, page.sourceThreadIds);
  const sub = parseSub(query, subcategories?.items);
  const threadIds = sub ? page.sourceThreadIds.filter((id) => subcategories!.byThread.get(id) === sub) : page.sourceThreadIds;

  const [categories, loaded, admin] = await Promise.all([
    getCategories(),
    loadPosts(threadIds, requestedPage),
    isAdmin(),
  ]);

  return (
    <article style={WIDE}>
      <CategoryNav categories={categories} active={slug} />
      {subcategories && subcategories.items.length > 0 && (
        <SubcategoryNav base={`/wiki/${slug}`} items={subcategories.items} active={sub} total={page.sourceThreadIds.length} />
      )}
      {/* Sem título: as pílulas já dizem a categoria. Só o admin vê o atalho para editar */}
      {admin && (
        <p className="m-0 text-right text-xs">
          <Link href={`/admin/editar/${page._id}`}>editar página</Link>
        </p>
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
        footer={<PostsPagination base={`/wiki/${slug}`} page={loaded.page} pages={loaded.pages} sub={sub} />}
      />
    </article>
  );
}
