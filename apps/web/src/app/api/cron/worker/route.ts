import { runPipeline } from "@sibs/worker";

export const dynamic = "force-dynamic";
// Tempo máximo da função (s). 300 cabe em qualquer configuração do plano Pro; com Fluid compute
// dá para subir (confira o limite em Settings → Functions na Vercel)
export const maxDuration = 300;
// Folga para montar as páginas e gerar os vetores depois de parar de classificar
const SAFETY_MS = 60_000;

/** Chamada pelo Cron Job da Vercel (vercel.json). Só aceita a Vercel, via CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }

  const started = Date.now();
  try {
    await runPipeline({ deadline: started + maxDuration * 1000 - SAFETY_MS });
    return Response.json({ ok: true, seconds: Math.round((Date.now() - started) / 1000) });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
