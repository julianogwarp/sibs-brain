import { notFound, redirect } from "next/navigation";
import { AllPosts } from "@/components/wiki/all-posts";
import { parsePageSegment } from "@/lib/wiki";

// Gerada na primeira visita e servida pronta depois (ISR)
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

/** /wiki/pagina/2 em diante; a página 1 é /wiki. */
export default async function AllPostsPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  if (n === "1") redirect("/wiki");
  const page = parsePageSegment(n);
  if (!page) notFound();
  return <AllPosts page={page} />;
}
