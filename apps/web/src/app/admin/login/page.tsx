import { redirect } from "next/navigation";
import { createSession } from "@/lib/session";
import { verifyPassword } from "@/lib/password";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const ok =
    email === process.env.ADMIN_EMAIL &&
    !!process.env.ADMIN_PASSWORD_HASH &&
    verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
  if (!ok) redirect("/admin/login?erro=1");
  await createSession();
  redirect("/admin");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <>
      <h1>Entrar</h1>
      {erro && <p className="muted">E-mail ou senha inválidos.</p>}
      <form action={login} style={{ display: "grid", gap: 12, maxWidth: 320 }}>
        <input name="email" type="email" placeholder="E-mail" required />
        <input name="password" type="password" placeholder="Senha" required />
        <button type="submit">Entrar</button>
      </form>
    </>
  );
}
