import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { pageHref } from "@/lib/wiki";

/** Páginas visíveis: primeira, última e vizinhas da atual; o resto vira "…". */
function pageList(page: number, pages: number): (number | "…")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function PostsPagination({ base, page, pages, sub = null }: { base: string; page: number; pages: number; sub?: string | null }) {
  if (pages <= 1) return null;
  const href = (p: number) => pageHref(base, p, sub);
  return (
    <Pagination className="mt-10">
      <PaginationContent>
        {page > 1 && (
          <PaginationItem>
            <PaginationPrevious href={href(page - 1)} text="Anterior" aria-label="Página anterior" />
          </PaginationItem>
        )}
        {pageList(page, pages).map((p, i) =>
          p === "…" ? (
            <PaginationItem key={`gap-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink href={href(p)} isActive={p === page} aria-label={`Página ${p}`}>
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        {page < pages && (
          <PaginationItem>
            <PaginationNext href={href(page + 1)} text="Próxima" aria-label="Próxima página" />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
