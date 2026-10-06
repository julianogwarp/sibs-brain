import { createHmac } from "node:crypto";
import { allowQuestion, answer, search, type Source } from "@sibs/ask";
import { BudgetExceededError } from "@sibs/db";

export const dynamic = "force-dynamic";

const MAX_LENGTH = 500;

/** Uma linha JSON por evento: fontes primeiro, depois os pedaços da resposta. */
export type AskEvent =
  | { type: "sources"; sources: Omit<Source, "score">[] }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

const UNAVAILABLE = "As perguntas estão pausadas até o próximo mês (limite de gasto atingido).";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 3 || question.length > MAX_LENGTH) {
    return Response.json({ error: `A pergunta precisa ter entre 3 e ${MAX_LENGTH} caracteres.` }, { status: 400 });
  }

  // Identifica o visitante sem guardar o IP: só um hash com o segredo do site
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
  const visitor = createHmac("sha256", process.env.SESSION_SECRET ?? "sibs-brain").update(ip).digest("hex").slice(0, 32);
  if (!(await allowQuestion(visitor))) {
    return Response.json({ error: "Você fez muitas perguntas nesta hora. Tente de novo mais tarde." }, { status: 429 });
  }

  let sources: Source[];
  try {
    sources = await search(question, process.env.X_USERNAME ?? "i");
  } catch (err) {
    if (err instanceof BudgetExceededError) return Response.json({ error: UNAVAILABLE }, { status: 503 });
    console.error(err);
    return Response.json({ error: "Não foi possível buscar agora. Tente de novo em instantes." }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AskEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      send({ type: "sources", sources: sources.map(({ score: _score, ...s }) => s) });
      try {
        if (sources.length === 0) {
          send({ type: "delta", text: "Ainda não há posts indexados para responder perguntas." });
        } else {
          for await (const text of answer(question, sources)) send({ type: "delta", text });
        }
        send({ type: "done" });
      } catch (err) {
        console.error(err);
        send({ type: "error", message: err instanceof BudgetExceededError ? UNAVAILABLE : "A resposta falhou no meio. Tente de novo." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
