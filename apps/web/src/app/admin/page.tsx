import Link from "next/link";
import { currentMonth, env, isRemovedTopic } from "@sibs/core";
import { collections } from "@sibs/db";
import { requireAdmin } from "@/lib/session";
import { logout, resolveReview, resolveSuggestion } from "./actions";

export const dynamic = "force-dynamic";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function Admin() {
  await requireAdmin();
  const c = await collections();
  const month = currentMonth();

  const [usage, review, suggestions, topics, lastRun, pages] = await Promise.all([
    c.usage.find({ month }).toArray(),
    c.classifications.find({ status: "needs_review" }).sort({ updatedAt: 1 }).limit(50).toArray(),
    c.suggestions.find({ resolved: false }).sort({ createdAt: 1 }).toArray(),
    c.topics.find().sort({ _id: 1 }).toArray(),
    c.ingestionRuns.find().sort({ startedAt: -1 }).limit(1).next(),
    c.pages.find({}, { projection: { title: 1 } }).sort({ title: 1 }).toArray(),
  ]);
  const threads = await c.threads.find({ _id: { $in: review.map((r) => r._id) } }).toArray();
  const threadText = new Map(threads.map((t) => [t._id, t.text]));

  const limits: Record<string, number> = {
    x: env().X_MONTHLY_BUDGET_BRL,
    llm: env().LLM_MONTHLY_BUDGET_BRL,
    embed: env().EMBED_MONTHLY_BUDGET_BRL,
    chat: env().CHAT_MONTHLY_BUDGET_BRL,
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Admin</h1>
        <form action={logout}><button type="submit">Sair</button></form>
      </div>

      <h2>Gasto em {month}</h2>
      <table>
        <thead><tr><th>Serviço</th><th>Gasto</th><th>Limite</th><th>Chamadas</th></tr></thead>
        <tbody>
          {["x", "jev", "llm", "embed", "chat"].map((s) => {
            const u = usage.find((x) => x.service === s);
            return (
              <tr key={s}>
                <td>{s}</td>
                <td>{brl(u?.spentBrl ?? 0)}</td>
                <td>{limits[s] !== undefined ? brl(limits[s]) : "—"}</td>
                <td>{u?.calls ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {lastRun && (
        <p className="muted">
          Última coleta: {lastRun.startedAt.toLocaleString("pt-BR")} · {lastRun.fetched} tweets · {lastRun.stoppedReason}
          {lastRun.error && ` · ${lastRun.error}`}
        </p>
      )}

      <h2>Fila de revisão ({review.length})</h2>
      {review.map((r) => (
        <div key={r._id} className="card">
          <blockquote>{threadText.get(r._id)}</blockquote>
          <p className="muted">
            jev: {r.jev.topic} / {r.jev.kind} ({Math.round(r.jev.confidence * 100)}%)
            {r.validation && ` · LLM: ${r.validation.reasoning}`}
          </p>
          <form action={resolveReview.bind(null, r._id)} style={{ display: "flex", gap: 8 }}>
            <select name="topic" defaultValue={r.validation?.topic ?? r.jev.topic}>
              {topics.filter((t) => !isRemovedTopic(t._id, t.name)).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
            <button name="decision" value="publish">Publicar</button>
            <button name="decision" value="reject">Rejeitar</button>
          </form>
        </div>
      ))}

      {/* O atalho fica aqui, e não na página pública, para ela não depender do cookie e poder ser estática */}
      <h2>Páginas</h2>
      <ul>
        {pages.filter((p) => !isRemovedTopic(p._id, p.title)).map((p) => (
          <li key={p._id}>
            <Link href={`/wiki/${p._id}`}>{p.title}</Link> · <Link href={`/admin/editar/${p._id}`}>editar</Link>
          </li>
        ))}
      </ul>

      <h2>Sugestões para páginas editadas à mão ({suggestions.length})</h2>
      {suggestions.map((s) => (
        <div key={s._id.toString()} className="card">
          <Link href={`/admin/editar/${s.pageId}`}>{s.pageId}</Link>: {s.threadIds.length} thread(s) nova(s)
          <form action={resolveSuggestion.bind(null, s._id.toString())}><button>Marcar como resolvida</button></form>
        </div>
      ))}
    </>
  );
}
