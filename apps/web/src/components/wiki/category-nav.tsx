import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/wiki";

/** Pílulas para alternar entre categorias; a atual tem a bolinha verde com ✓. */
export function CategoryNav({ categories, active }: { categories: Category[]; active: string | null }) {
  const items = [{ slug: null, title: "Todos os posts" }, ...categories.map((c) => ({ slug: c.slug, title: c.title }))];
  return (
    <nav aria-label="Categorias" className="mb-8">
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        {items.map((c) => {
          const current = c.slug === active;
          return (
            <li key={c.slug ?? "todos"} className="m-0">
              <Link
                href={c.slug ? `/wiki/${c.slug}` : "/wiki"}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-full border border-[#353535] pl-2 pr-5 text-[15px] text-foreground no-underline transition-colors hover:border-[#4a4a4a] hover:bg-white/5 hover:no-underline",
                  current && "border-[#4a4a4a]",
                )}
              >
                {current ? (
                  <span className="flex size-7 items-center justify-center rounded-full bg-brand text-brand-foreground">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="size-7 rounded-full border border-[#3a3a3a] bg-[#1c1c1c]" />
                )}
                {c.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
