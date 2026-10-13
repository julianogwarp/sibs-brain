/**
 * Confere se o turbo.json (tasks.build.env) lista exatamente as variáveis do schema em
 * packages/core/src/env.ts. Em Strict Mode o turbo esconde do build o que não estiver lá.
 */
import { readFileSync } from "node:fs";
import { ENV_KEYS } from "../packages/core/src/env.ts";

const turbo = JSON.parse(readFileSync(new URL("../turbo.json", import.meta.url), "utf8"));
const listed = new Set<string>(turbo.tasks.build.env ?? []);
const missing = ENV_KEYS.filter((k) => !listed.has(k));
const extra = [...listed].filter((k) => !(ENV_KEYS as string[]).includes(k));

if (missing.length) console.error(`Faltam no turbo.json: ${missing.join(", ")}`);
if (extra.length) console.error(`Sobram no turbo.json (não existem no schema): ${extra.join(", ")}`);
if (missing.length || extra.length) process.exit(1);
console.log(`turbo.json em dia (${ENV_KEYS.length} variáveis)`);
