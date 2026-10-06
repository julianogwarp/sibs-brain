import type { Tweet } from "@sibs/core";
import { adjustSpend, reserveBudget } from "@sibs/db";

const API = "https://api.x.com/2";
const PAGE_SIZE = 100; // máximo permitido em /users/:id/tweets

export interface XSourceConfig {
  bearerToken: string;
  monthlyBudgetBrl: number;
  costPerTweetBrl: number;
  costPerRequestBrl: number;
  /** Não coleta respostas (inclusive a continuação das threads do próprio autor). */
  excludeReplies: boolean;
}

export function configFromEnv(): XSourceConfig {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) throw new Error("X_BEARER_TOKEN não definido");
  return {
    bearerToken,
    monthlyBudgetBrl: Number(process.env.X_MONTHLY_BUDGET_BRL ?? 50),
    costPerTweetBrl: Number(process.env.X_COST_PER_TWEET_BRL ?? 0),
    costPerRequestBrl: Number(process.env.X_COST_PER_REQUEST_BRL ?? 0),
    excludeReplies: (process.env.X_EXCLUDE_REPLIES ?? "true") !== "false",
  };
}

interface ApiTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  conversation_id: string;
  referenced_tweets?: { type: "replied_to" | "quoted" | "retweeted"; id: string }[];
  entities?: { urls?: { expanded_url: string }[] };
  public_metrics: { like_count: number; retweet_count: number; reply_count: number; quote_count: number };
}

interface TimelineResponse {
  data?: ApiTweet[];
  meta: { result_count: number; newest_id?: string; oldest_id?: string; next_token?: string };
}

export interface FetchPageOptions {
  sinceId?: string; // só tweets mais novos que este
  untilId?: string; // só tweets mais antigos que este (histórico)
  paginationToken?: string;
}

export class XApiError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`X API ${status}: ${body}`);
  }
}

interface CountsResponse {
  data?: { start: string; end: string; tweet_count: number }[];
  meta: { total_tweet_count: number; next_token?: string };
}

export interface TweetCount {
  total: number;
  /** "all": contagem exata no período; "recent": só os últimos 7 dias (sem acesso ao arquivo completo) */
  source: "all" | "recent";
  from: Date;
  to: Date;
}

export class XSource {
  constructor(private readonly config: XSourceConfig) {}

  async getUser(username: string) {
    const res = await this.request<{ data: { id: string; created_at: string; public_metrics: { tweet_count: number } } }>(
      `/users/by/username/${encodeURIComponent(username)}`,
      { "user.fields": "public_metrics,created_at" },
      0,
    );
    return { id: res.data.id, tweetCount: res.data.public_metrics.tweet_count, createdAt: new Date(res.data.created_at) };
  }

  /**
   * Conta os tweets do autor (sem retweets, e sem respostas se configurado) desde `start`.
   * Usa o arquivo completo; se o plano não tiver acesso, cai para os últimos 7 dias.
   */
  async countTweets(username: string, start: Date): Promise<TweetCount> {
    const query = `from:${username} -is:retweet${this.config.excludeReplies ? " -is:reply" : ""}`;
    try {
      return await this.sumCounts("/tweets/counts/all", query, start, "all");
    } catch (err) {
      if (!(err instanceof XApiError) || (err.status !== 403 && err.status !== 401)) throw err;
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000 + 60_000);
      return this.sumCounts("/tweets/counts/recent", query, start > weekAgo ? start : weekAgo, "recent");
    }
  }

  private async sumCounts(path: string, query: string, start: Date, source: TweetCount["source"]): Promise<TweetCount> {
    let total = 0;
    let token: string | undefined;
    do {
      const params: Record<string, string> = { query, granularity: "day", start_time: start.toISOString() };
      if (token) params.next_token = token;
      const res = await this.request<CountsResponse>(path, params, 0);
      total += res.meta.total_tweet_count;
      token = res.meta.next_token;
    } while (token);
    return { total, source, from: start, to: new Date() };
  }

  async getUserId(username: string): Promise<string> {
    const res = await this.request<{ data: { id: string } }>(`/users/by/username/${encodeURIComponent(username)}`, {}, 0);
    return res.data.id;
  }

  /** Busca uma página da timeline. Reserva o custo máximo antes e ajusta pelo real depois. */
  async fetchTimelinePage(userId: string, opts: FetchPageOptions = {}) {
    const params: Record<string, string> = {
      max_results: String(PAGE_SIZE),
      exclude: this.config.excludeReplies ? "retweets,replies" : "retweets",
      "tweet.fields": "created_at,conversation_id,referenced_tweets,entities,public_metrics,author_id",
    };
    if (opts.sinceId) params.since_id = opts.sinceId;
    if (opts.untilId) params.until_id = opts.untilId;
    if (opts.paginationToken) params.pagination_token = opts.paginationToken;

    const res = await this.request<TimelineResponse>(`/users/${userId}/tweets`, params, PAGE_SIZE);
    const tweets = (res.data ?? []).map(toTweet);
    return { tweets, meta: res.meta };
  }

  private async request<T>(path: string, params: Record<string, string>, maxItems: number): Promise<T> {
    const { costPerRequestBrl, costPerTweetBrl, monthlyBudgetBrl } = this.config;
    const reserved = costPerRequestBrl + maxItems * costPerTweetBrl;
    await reserveBudget("x", reserved, monthlyBudgetBrl);

    const url = new URL(API + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${this.config.bearerToken}` } });
    } catch (err) {
      await adjustSpend("x", -reserved);
      throw err;
    }

    if (!res.ok) {
      await adjustSpend("x", -reserved);
      throw new XApiError(res.status, await res.text());
    }

    const body = (await res.json()) as T & { meta?: { result_count?: number } };
    const actualItems = body.meta?.result_count ?? (maxItems === 0 ? 0 : maxItems);
    await adjustSpend("x", (actualItems - maxItems) * costPerTweetBrl);
    return body;
  }
}

function toTweet(t: ApiTweet): Tweet {
  const ref = (type: string) => t.referenced_tweets?.find((r) => r.type === type)?.id ?? null;
  return {
    _id: t.id,
    authorId: t.author_id,
    text: t.text,
    createdAt: new Date(t.created_at),
    conversationId: t.conversation_id,
    inReplyToTweetId: ref("replied_to"),
    quotedTweetId: ref("quoted"),
    urls: t.entities?.urls?.map((u) => u.expanded_url) ?? [],
    metrics: {
      likes: t.public_metrics.like_count,
      retweets: t.public_metrics.retweet_count,
      replies: t.public_metrics.reply_count,
      quotes: t.public_metrics.quote_count,
    },
    fetchedAt: new Date(),
  };
}
