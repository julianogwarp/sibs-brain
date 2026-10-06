"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, ChevronRight, Hash, RotateCcw, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/wiki";
import type { AskEvent } from "./api/perguntar/route";


type Sources = Extract<AskEvent, { type: "sources" }>["sources"];

interface Turn {
  id: number;
  question: string;
  answer: string;
  sources: Sources;
  status: "loading" | "streaming" | "done" | "error";
  error?: string;
}

const MAX_LENGTH = 500;
const shortDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" });

export function HomeChat({ categories }: { categories: Category[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const last = turns.at(-1);
  const busy = last?.status === "loading" || last?.status === "streaming";

  // Acompanha a resposta enquanto ela chega
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [last?.answer, last?.status, turns.length]);

  const update = (id: number, patch: Partial<Turn> | ((t: Turn) => Partial<Turn>)) =>
    setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const question = draft.trim();
    if (question.length < 3 || busy) return;

    const id = Date.now();
    setTurns((all) => [...all, { id, question, answer: "", sources: [], status: "loading" }]);
    setDraft("");
    abort.current = new AbortController();

    try {
      const res = await fetch("/api/perguntar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: abort.current.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Algo deu errado. Tente de novo.");
      }

      update(id, { status: "streaming" });
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as AskEvent;
          if (event.type === "sources") update(id, { sources: event.sources });
          else if (event.type === "delta") update(id, (t) => ({ answer: t.answer + event.text }));
          else if (event.type === "error") throw new Error(event.message);
        }
      }
      update(id, { status: "done" });
    } catch (err) {
      const stopped = (err as Error).name === "AbortError";
      update(id, stopped ? { status: "done" } : { status: "error", error: (err as Error).message });
    }
  }

  // Volta para a tela inicial e começa um novo ciclo de perguntas
  function reset() {
    abort.current?.abort();
    setTurns([]);
    setDraft("");
    window.scrollTo({ top: 0 });
  }

  const composer = (
    <Composer
      value={draft}
      onChange={setDraft}
      onSubmit={send}
      onStop={() => abort.current?.abort()}
      busy={busy}
    />
  );

  // Tela inicial: saudação e barra no centro exato da tela; categorias logo abaixo
  if (turns.length === 0) {
    return (
      <div>
        {/* Barra por volta de 28% da altura da tela, para as categorias logo abaixo aparecerem sem rolar.
            O max() garante espaço para a saudação + barra em janelas baixas. */}
        <div className="flex min-h-[max(8rem,calc(32dvh-5rem))] flex-col justify-end">
          <h1 className="mb-7 mt-0 text-center text-[28px] font-normal leading-tight tracking-normal">Por onde começamos?</h1>
          {composer}
        </div>
        <div className="pt-8">
          <CategoryList categories={categories} />
        </div>
      </div>
    );
  }

  // Conversa: mensagens e a barra fixa no rodapé
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem-5.5rem)] flex-col">
      <div className="flex-1 space-y-8 pb-8">
        {turns.map((t) => (
          <TurnView key={t.id} turn={t} />
        ))}
        <div ref={bottom} />
      </div>
      <div className="sticky bottom-0 bg-gradient-to-t from-background from-70% to-transparent pt-6 pb-3">
        {composer}
        <div className="mt-2 flex flex-col items-center gap-1 text-center">
          <button
            type="button"
            data-slot="new-question"
            onClick={reset}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-sm text-foreground underline-offset-4 hover:bg-white/5 hover:underline"
          >
            <RotateCcw className="size-3.5" />
            Fazer uma nova pergunta
          </button>
          <p className="m-0 text-xs text-muted-foreground">As respostas usam só os posts encontrados e podem errar. Confira as fontes.</p>
        </div>
      </div>
    </div>
  );
}

function Composer(props: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
}) {
  const { value, onChange, onSubmit, onStop, busy } = props;
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length >= 3;

  // Cresce com o texto até ~8 linhas
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit();
    }
  };

  const iconButton = "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex min-h-14 items-end gap-1 rounded-[28px] border border-composer-border bg-composer p-2 pl-4 shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
    >
      <textarea
        ref={ref}
        data-slot="composer"
        rows={1}
        value={value}
        maxLength={MAX_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Pergunte sobre graphql"
        aria-label="Pergunta"
        className="max-h-[200px] flex-1 resize-none self-center bg-transparent px-2 py-2 text-[17px] leading-6 text-foreground outline-none placeholder:text-[#afafaf]"
      />

      {busy ? (
        <button type="button" onClick={onStop} aria-label="Parar resposta" data-slot="composer-button" className={cn(iconButton, "bg-white text-black hover:bg-white/90")}>
          <Square className="size-3.5 fill-current" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Enviar pergunta"
          data-slot="composer-button"
          className={cn(iconButton, canSend ? "bg-white text-black hover:bg-white/90" : "cursor-default bg-composer-button text-[#8f8f8f]")}
        >
          <ArrowUp className="size-5" strokeWidth={2} />
        </button>
      )}
    </form>
  );
}

function CategoryList({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return <p className="text-center text-sm text-muted-foreground">Nenhuma categoria ainda. Rode o worker para gerar as primeiras.</p>;
  }
  return (
    <nav aria-label="Categorias">
      <h2 className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Categorias</h2>
      <ul className="m-0 list-none divide-y divide-border/60 p-0">
        {categories.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/wiki/${c.slug}`}
              className="group flex items-center gap-3 rounded-xl px-3 py-3 text-foreground no-underline transition-colors hover:bg-muted hover:no-underline"
            >
              <Hash className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate font-medium">{c.title}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {c.posts} {c.posts === 1 ? "post" : "posts"}
              </span>
              {/* No hover a seta desliza para a direita e acende */}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-all duration-200 ease-out group-hover:translate-x-1.5 group-hover:text-foreground motion-reduce:transition-none" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  const cited = new Set([...turn.answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const sources = cited.size > 0 ? turn.sources.filter((s) => cited.has(s.n)) : turn.sources;
  const finished = turn.status === "done" || turn.status === "error";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <p className="max-w-[80%] whitespace-pre-wrap rounded-3xl bg-composer px-5 py-2.5">{turn.question}</p>
      </div>

      <div aria-live="polite">
        {turn.status === "loading" && <p className="animate-pulse text-muted-foreground">Buscando nos posts…</p>}
        {turn.answer && <AnswerText text={turn.answer} turnId={turn.id} streaming={turn.status === "streaming"} />}
        {turn.error && <p className="text-sm text-destructive">{turn.error}</p>}

        {finished && sources.length > 0 && (
          <ol className="mt-4 list-none space-y-2 p-0 text-sm">
            {sources.map((s) => (
              <li key={s.threadId} id={`fonte-${turn.id}-${s.n}`} className="flex gap-3 rounded-xl border px-3 py-2">
                <span className="shrink-0 font-medium tabular-nums text-muted-foreground">{s.n}</span>
                <div className="min-w-0">
                  <p className="line-clamp-2">{s.text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {shortDate.format(new Date(s.date))}
                    {s.topic && (
                      <>
                        {" · "}
                        <Link href={`/wiki/${s.topic.slug}`}>{s.topic.title}</Link>
                      </>
                    )}
                    {" · "}
                    <a href={s.tweetUrl} target="_blank" rel="noreferrer">
                      ver no X
                    </a>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/** Resposta com as citações [n] virando marcadores clicáveis para a fonte. */
function AnswerText({ text, turnId, streaming }: { text: string; turnId: number; streaming: boolean }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <div className={cn("whitespace-pre-wrap leading-7", streaming && "after:ml-0.5 after:animate-pulse after:content-['▍']")}>
      {parts.map((part, i) => {
        const n = /^\[(\d+)\]$/.exec(part)?.[1];
        return n ? (
          <a
            key={i}
            href={`#fonte-${turnId}-${n}`}
            className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 align-text-top text-[11px] font-medium text-muted-foreground no-underline hover:bg-accent hover:no-underline"
          >
            {n}
          </a>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </div>
  );
}
