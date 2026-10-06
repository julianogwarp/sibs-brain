import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { HeaderMenu } from "@/components/header-menu";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "sibs-brain",
  description: "Uma wiki construída a partir dos tweets de um autor",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="font-sans antialiased">
      <body>
        <header className="flex h-14 items-center justify-between px-3">
          <HeaderMenu />
        </header>
        <main>{children}</main>
        {/* Vercel Web Analytics: visitantes e páginas vistas em todas as páginas (painel do projeto → Analytics) */}
        <Analytics />
      </body>
    </html>
  );
}
