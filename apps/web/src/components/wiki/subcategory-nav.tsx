import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { pageHref, type Subcategory } from "@/lib/wiki";

/** Pílulas menores, logo abaixo das categorias, para filtrar por subcategoria. */
export function SubcategoryNav({ base, items, active, total }: { base: string; items: Subcategory[]; active: string | null; total: number }) {
  const all = [{ slug: null, name: "Tudo", count: total }, ...items];
  return (
    <nav aria-label="Subcategorias" className="-mt-4 mb-8">
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {all.map((s) => {
          const current = s.slug === active;
          return (
            <li key={s.slug ?? "tudo"} className="m-0">
              <Link
                href={pageHref(base, 1, s.slug)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-full border border-[#2c2c2c] pl-1.5 pr-3 text-[13px] text-foreground no-underline transition-colors hover:border-[#4a4a4a] hover:bg-white/5 hover:no-underline",
                  current && "border-[#4a4a4a] bg-white/5",
                )}
              >
                {current ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="size-5 rounded-full border border-[#3a3a3a] bg-[#1c1c1c]" />
                )}
                {s.name}
                <span className="tabular-nums text-muted-foreground">{s.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
