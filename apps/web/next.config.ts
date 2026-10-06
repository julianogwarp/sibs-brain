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
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default config;
