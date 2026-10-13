import { notFound } from "next/navigation";
import { getPage } from "@sibs/db";
import { requireAdmin } from "@/lib/session";
import { savePage } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <>
      <h1>Editar: {page.title}</h1>
      <p className="muted">Depois de salvar, o worker não sobrescreve mais esta página; novidades viram sugestões no /admin.</p>
      <form action={savePage.bind(null, slug)} className="page-editor" style={{ display: "grid", gap: 12 }}>
        <input name="title" defaultValue={page.title} required />
        <textarea name="body" defaultValue={page.body} />
        <button type="submit">Salvar revisão {page.revision + 1}</button>
      </form>
    </>
  );
}
