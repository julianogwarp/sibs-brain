import { z } from "zod";

const number = (fallback: number) => z.coerce.number({ error: "número inválido" }).finite().min(0).default(fallback);
const ratio = (fallback: number) => z.coerce.number().min(0).max(1).default(fallback);
const count = (fallback: number) => z.coerce.number().int().positive().default(fallback);

/**
 * Todas as variáveis de ambiente do projeto, com os valores padrão. É a única fonte: o turbo.json
 * (tasks.build.env) e o .env.example devem listar estas chaves (`npm run check:env` confere o turbo.json).
 *
 * Segredos são opcionais aqui porque nem todo processo precisa de todos (a web roda sem X_BEARER_TOKEN
 * em desenvolvimento, por exemplo); quem precisa usa `requireEnv`, que falha com o nome da variável.
 */
export const EnvSchema = z
  .object({
    // Banco
    MONGODB_URI: z.string().optional(),
    MONGODB_DB: z.string().default("sibs-brain"),

    // Coleta (X API)
    X_USERNAME: z.string().optional(),
    X_BEARER_TOKEN: z.string().optional(),
    X_START_DATE: z.coerce.date({ error: "data inválida (use AAAA-MM-DD)" }).optional(), // mais antigo a coletar (ex.: 2026-01-01)
    X_EXCLUDE_REPLIES: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
    X_MONTHLY_BUDGET_BRL: number(50),
    X_COST_PER_TWEET_BRL: number(0),
    X_COST_PER_REQUEST_BRL: number(0),

    // Classificação: jev publica direto acima de CONFIDENCE_PUBLISH; entre as duas, a LLM valida
    CONFIDENCE_PUBLISH: ratio(0.8),
    CONFIDENCE_VALIDATE: ratio(0.5),
    TYPESAFE_API_KEY: z.string().optional(), // lida pelo SDK do jev; aqui só para constar na lista
    OPENAI_API_KEY: z.string().optional(), // lida pelo SDK da OpenAI; aqui só para constar na lista
    VALIDATOR_MODEL: z.string().default("gpt-6-luna"),
    VALIDATOR_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("medium"),
    VALIDATOR_USD_PER_MTOK_INPUT: number(0.1),
    VALIDATOR_USD_PER_MTOK_OUTPUT: number(0.5),
    LLM_MONTHLY_BUDGET_BRL: number(30),

    // Perguntas da home
    CHAT_MODEL: z.string().default("gpt-6-luna"),
    CHAT_USD_PER_MTOK_INPUT: number(0.1),
    CHAT_USD_PER_MTOK_OUTPUT: number(0.5),
    CHAT_MONTHLY_BUDGET_BRL: number(10),
    CHAT_MAX_PER_HOUR: count(10),
    CHAT_MAX_GLOBAL_PER_HOUR: count(200),
    EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    EMBEDDING_USD_PER_MTOK: number(0.02),
    EMBED_MONTHLY_BUDGET_BRL: number(5),

    USD_BRL: z.coerce.number().positive().default(5.5),

    // Admin e segurança
    ADMIN_EMAIL: z.string().optional(),
    ADMIN_PASSWORD_HASH: z.string().optional(),
    SESSION_SECRET: z.string().optional(), // < 32 caracteres desativa o login (as páginas públicas seguem)
    CRON_SECRET: z.string().optional(),
  })
  .refine((e) => e.CONFIDENCE_VALIDATE <= e.CONFIDENCE_PUBLISH, {
    path: ["CONFIDENCE_VALIDATE"],
    message: "precisa ser menor ou igual a CONFIDENCE_PUBLISH",
  });

export type Env = z.infer<typeof EnvSchema>;
export const ENV_KEYS = Object.keys(EnvSchema.shape) as (keyof Env)[];

let cached: Env | null = null;

/**
 * Variáveis já validadas e com os padrões aplicados. Lê o ambiente na primeira chamada (e não no import),
 * para o .env já ter sido carregado; um valor inválido derruba com a lista do que está errado.
 */
export function env(): Env {
  if (cached) return cached;
  // Variável vazia (comum na Vercel e em .env) vale como ausente, para cair no padrão
  const raw = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k] === "" ? undefined : process.env[k]]));
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${problems}`);
  }
  cached = parsed.data;
  return cached;
}

/** Valor obrigatório para quem chama; falha com o nome da variável se estiver faltando. */
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env()[key];
  if (value === undefined || value === null) throw new Error(`${key} não definido`);
  return value as NonNullable<Env[K]>;
}
