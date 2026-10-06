import type { ReactNode } from "react";

export interface GridPost {
  id: string;
  text: string;
  url: string;
  when: string; // "5 de out. de 2026, 14:32", já no fuso da wiki
}

// Linhas em branco (entre tweets da thread ou dentro do tweet) viram uma quebra simples, sem espaço vazio
const compact = (text: string) => text.replace(/\n\s*\n+/g, "\n").trim();

/** Tweets em colunas e linhas, no estilo de lista de manchetes: um ponto antes de cada post e a data embaixo. */
export function PostGrid({ posts, subtitle, actions, footer }: { posts: GridPost[]; subtitle?: string; actions?: ReactNode; footer?: ReactNode }) {
  return (
    <section className="my-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="m-0 text-sm font-extrabold uppercase tracking-wide">Posts</h2>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
        {actions}
      </div>
      {posts.length === 0 && <p className="text-muted-foreground">Nenhum post nesse período.</p>}
      <ul className="m-0 grid list-none grid-cols-1 gap-x-8 gap-y-9 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {posts.map((p) => (
          <li key={p.id} className="m-0 flex gap-2.5">
            {/* Ponto alinhado ao meio da primeira linha do texto */}
            <span aria-hidden className="mt-[0.43em] size-1.5 shrink-0 rounded-full bg-foreground" />
            <div className="min-w-0">
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="whitespace-pre-line [overflow-wrap:anywhere] font-posts text-[15px] font-normal leading-[1.25] text-foreground no-underline decoration-1 underline-offset-2 hover:underline"
              >
                {compact(p.text)}
              </a>
              <p className="mb-0 mt-1.5 text-xs text-muted-foreground">{p.when}</p>
            </div>
          </li>
        ))}
      </ul>
      {footer}
    </section>
  );
}
