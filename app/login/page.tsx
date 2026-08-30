import { redirect } from "next/navigation";

import { authEnabled, signIn } from "@/auth";

/**
 * Login por e-mail e senha. Não há link de cadastro: os usuários são criados
 * manualmente com `npm run user:create` (CLAUDE.md, seção 6). Por isso a tela
 * não convida a criar conta nem a recuperar senha — não existe nenhum dos dois
 * caminhos, e oferecê-los seria mentir.
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
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <p className="expandida text-sm font-semibold text-osso-fraco">
          Planilha em <span className="text-osso">dashboard</span>
        </p>
        <h1 className="expandida mt-3 text-2xl font-semibold text-osso">Entrar</h1>
      </div>

      <form action={authenticate} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="utilitaria text-osso-fraco">E-mail</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className={campoClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="utilitaria text-osso-fraco">Senha</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={campoClass}
          />
        </label>

        {failed ? (
          <p className="border-l-2 border-alarme bg-bancada-alta px-3 py-2 text-sm text-alarme">
            E-mail ou senha inválidos. Confira os dois e tente de novo.
          </p>
        ) : null}

        <button
          type="submit"
          className="expandida mt-1 rounded-[3px] bg-osso px-4 py-2 text-sm font-semibold text-bancada transition-colors hover:bg-white"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}

const campoClass =
  "rounded-[3px] border border-borda bg-bancada-alta px-3 py-2 text-sm text-osso transition-colors hover:border-borda-forte focus:border-osso-fraco focus:outline-none";
