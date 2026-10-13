import { env, requireEnv } from "@sibs/core";
import { closeDb, getMonthlySpend } from "@sibs/db";
import { configFromEnv, XSource } from "@sibs/x-source";

/**
 * Mostra quantos tweets existem desde X_START_DATE e quanto custaria coletá-los,
 * sem baixar nenhum tweet (só contagens).
 */
async function main() {
  const username = requireEnv("X_USERNAME");
  const config = configFromEnv();
  const x = new XSource(config);

  const start = env().X_START_DATE ?? new Date(`${new Date().getFullYear()}-01-01`);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const user = await x.getUser(username);
  console.log(`@${username}: ${user.tweetCount.toLocaleString("pt-BR")} tweets na conta (inclui respostas e retweets)`);

  const count = await x.countTweets(username, start);
  const days = Math.max(1, (count.to.getTime() - count.from.getTime()) / 86_400_000);
  const perDay = count.total / days;
  const what = config.excludeReplies ? "sem respostas e retweets" : "sem retweets";

  let estimate: number;
  if (count.source === "all") {
    estimate = count.total;
    console.log(`Desde ${day(start)} (${what}): ${estimate.toLocaleString("pt-BR")} tweets (${perDay.toFixed(1)}/dia)`);
  } else {
    const totalDays = (Date.now() - start.getTime()) / 86_400_000;
    estimate = Math.round(perDay * totalDays);
    console.log(`Seu plano só permite contar os últimos 7 dias: ${count.total} tweets (${perDay.toFixed(1)}/dia, ${what})`);
    console.log(`Estimativa desde ${day(start)}, mantendo esse ritmo: ~${estimate.toLocaleString("pt-BR")} tweets`);
  }

  const cap = config.excludeReplies ? 800 : 3200;
  const reachable = Math.min(estimate, cap);
  const spent = await getMonthlySpend("x");
  console.log("");
  console.log(`A timeline da X entrega no máximo ~${cap} tweets ${config.excludeReplies ? "sem respostas" : ""}`.trimEnd() + ".");
  console.log(`Coletáveis: ~${reachable.toLocaleString("pt-BR")} tweets → ~${brl(reachable * config.costPerTweetBrl)} (a ${brl(config.costPerTweetBrl)} por tweet)`);
  if (estimate > cap) {
    const coveredDays = cap / perDay;
    console.log(`Isso cobre só os últimos ~${Math.round(coveredDays)} dias; não chega em ${day(start)}.`);
  }
  console.log(`Gasto com a X neste mês: ${brl(spent)} de ${brl(config.monthlyBudgetBrl)}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(closeDb);
