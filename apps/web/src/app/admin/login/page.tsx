import { redirect } from "next/navigation";
import { env } from "@sibs/core";
import { allowAction } from "@/lib/rate-limit";
import { createSession, safeEqual } from "@/lib/session";
import { verifyPassword } from "@/lib/password";

async function login(formData: FormData) {
  "use server";
  // Até 5 tentativas a cada 15 minutos por visitante, contra adivinhação de senha
  if (!(await allowAction("login", 5, 15))) redirect("/admin/login?erro=limite");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD_HASH: hash } = env();
  const ok = !!adminEmail && !!hash && safeEqual(email, adminEmail) && verifyPassword(password, hash);
  if (!ok) redirect("/admin/login?erro=1");
  await createSession();
  redirect("/admin");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <>
      <h1>Entrar</h1>
      {erro && (
        <p className="muted">
          {erro === "limite" ? "Muitas tentativas. Espere 15 minutos e tente de novo." : "E-mail ou senha inválidos."}
        </p>
      )}
      <form action={login} style={{ display: "grid", gap: 12, maxWidth: 320 }}>
        <input name="email" type="email" placeholder="E-mail" required />
        <input name="password" type="password" placeholder="Senha" required />
        <button type="submit">Entrar</button>
      </form>
    </>
  );
}
