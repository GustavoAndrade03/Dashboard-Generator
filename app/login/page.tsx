import { redirect } from "next/navigation";

import { authEnabled, signIn } from "@/auth";

/**
 * Login por e-mail e senha. Não há link de cadastro: os usuários são criados
 * manualmente com `npm run user:create` (CLAUDE.md, seção 6).
 */
export default async function LoginPage(props: PageProps<"/login">) {
  if (!authEnabled) redirect("/");
  const params = await props.searchParams;
  const failed = params.erro === "1";

  async function authenticate(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirectTo: "/",
      });
    } catch (error) {
      // signIn sinaliza o redirecionamento lançando: só credenciais inválidas
      // devem virar mensagem de erro.
      if (error instanceof Error && error.constructor.name === "CredentialsSignin") {
        redirect("/login?erro=1");
      }
      throw error;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold text-[#0b0b0b]">Entrar</h1>

      <form action={authenticate} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-[#52514e]">
          E-mail
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="rounded border border-[#e1e0d9] bg-white px-3 py-2 text-[#0b0b0b] focus:border-[#2a78d6] focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-[#52514e]">
          Senha
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded border border-[#e1e0d9] bg-white px-3 py-2 text-[#0b0b0b] focus:border-[#2a78d6] focus:outline-none"
          />
        </label>

        {failed ? <p className="text-sm text-[#e34948]">E-mail ou senha inválidos.</p> : null}

        <button
          type="submit"
          className="rounded-md bg-[#0b0b0b] px-4 py-2 text-sm font-medium text-white"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
