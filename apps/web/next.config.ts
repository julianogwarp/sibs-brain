import type { NextConfig } from "next";

// O .env fica na raiz do monorepo; o Next só procura em apps/web
try {
  process.loadEnvFile("../../.env");
} catch {
  console.warn("[web] .env da raiz não encontrado; usando só as variáveis do ambiente");
}

const config: NextConfig = {
  // Pacotes do monorepo são TypeScript puro; o Next compila. O worker entra pela rota do Cron
  transpilePackages: [
    "@sibs/core",
    "@sibs/db",
    "@sibs/ask",
    "@sibs/worker",
    "@sibs/classifier",
    "@sibs/validator",
    "@sibs/wiki-engine",
    "@sibs/x-source",
  ],
  serverExternalPackages: ["mongodb"],
};

export default config;
