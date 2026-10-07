import { MongoClient, type Db } from "mongodb";
import type {
  Classification,
  Embedding,
  RateLimit,
  IngestionRun,
  Page,
  PageSuggestion,
  Revision,
  Thread,
  Topic,
  Tweet,
  Usage,
} from "@sibs/core";

let client: MongoClient | null = null;
// Promise compartilhada: requisições simultâneas reaproveitam a mesma conexão
let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  dbPromise ??= connect().catch((err) => {
    dbPromise = null; // permite tentar de novo na próxima requisição
    throw err;
  });
  return dbPromise;
}

/** URI sem usuário e senha, para mensagens de erro e logs. */
function redact(uri: string): string {
  return uri.replace(/\/\/[^@/]*@/, "//***@");
}

async function connect(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI não definido");
  // Cada instância da função na Vercel tem seu próprio pool: com o padrão (100) e muitas instâncias
  // em pico, o Atlas chega ao limite de conexões do cluster. 10 por instância dá conta das consultas
  const c = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000, maxPoolSize: 10 });
  try {
    await c.connect();
  } catch (err) {
    await c.close().catch(() => {});
    const reason = err instanceof Error ? err.message : String(err);
    // Nunca a URI completa: ela tem a senha do banco e iria parar nos logs
    throw new Error(`Não foi possível conectar ao Mongo em ${redact(uri)}. Ele está rodando? (${redact(reason)})`);
  }
  client = c;
  return c.db(process.env.MONGODB_DB ?? "sibs-brain");
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
  dbPromise = null;
}

export async function collections() {
  const d = await getDb();
  return {
    tweets: d.collection<Tweet>("tweets"),
    threads: d.collection<Thread>("threads"),
    classifications: d.collection<Classification>("classifications"),
    topics: d.collection<Topic>("topics"),
    pages: d.collection<Page>("pages"),
    revisions: d.collection<Revision>("revisions"),
    suggestions: d.collection<PageSuggestion>("suggestions"),
    ingestionRuns: d.collection<IngestionRun>("ingestion_runs"),
    usage: d.collection<Usage>("usage"),
    embeddings: d.collection<Embedding>("embeddings"),
    rateLimits: d.collection<RateLimit>("rate_limits"),
  };
}

export async function ensureIndexes(): Promise<void> {
  const c = await collections();
  await Promise.all([
    c.tweets.createIndex({ conversationId: 1, createdAt: 1 }),
    c.tweets.createIndex({ createdAt: -1 }),
    c.classifications.createIndex({ status: 1, updatedAt: 1 }),
    c.pages.createIndex({ topicId: 1 }),
    c.pages.createIndex({ title: "text", body: "text" }),
    c.revisions.createIndex({ pageId: 1, revision: -1 }, { unique: true }),
    c.suggestions.createIndex({ resolved: 1, createdAt: 1 }),
    c.ingestionRuns.createIndex({ startedAt: -1 }),
    // O Mongo apaga sozinho os contadores de limite expirados
    c.rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
