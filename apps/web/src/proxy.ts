import { NextResponse, type NextRequest } from "next/server";

/**
 * Links antigos com ?sub= e ?pagina= (de antes das páginas estáticas) vão para a URL nova, só com caminho:
 * /wiki?pagina=2 → /wiki/pagina/2 · /wiki/tecnologia?sub=frontend&pagina=2 → /wiki/tecnologia/frontend/2
 */
export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const sub = searchParams.get("sub");
  const pageRaw = searchParams.get("pagina");
  if (sub === null && pageRaw === null) return NextResponse.next();

  const page = Math.max(1, Math.floor(Number(pageRaw) || 1));
  const topic = pathname.replace(/^\/wiki\/?/, "");
  let target: string;
  if (!topic) target = page > 1 ? `/wiki/pagina/${page}` : "/wiki";
  else target = `/wiki/${topic}${sub ? `/${encodeURIComponent(sub)}` : ""}${page > 1 ? `/${page}` : ""}`;

  const url = req.nextUrl.clone();
  url.pathname = target;
  url.search = "";
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/wiki", "/wiki/:slug"],
};
