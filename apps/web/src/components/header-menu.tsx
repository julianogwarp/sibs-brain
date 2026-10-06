"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Início" },
  { href: "/wiki", label: "Categorias" },
];

/** Logo + nome com menu suspenso; fecha ao clicar fora, com Esc, ao escolher um item ou ao mudar de página. */
export function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-slot="header-menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-lg font-semibold text-foreground hover:bg-muted"
      >
        <Image src="/logo.png" alt="" width={28} height={28} priority className="mr-1.5 size-7 rounded-full object-cover" />
        sibs-brain
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <nav role="menu" className="absolute left-0 top-full z-20 mt-1 w-44 rounded-2xl border bg-popover p-1.5 text-sm shadow-lg">
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-foreground no-underline hover:bg-accent hover:no-underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
