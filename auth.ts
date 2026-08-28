/**
 * Autenticação (Auth.js v5).
 *
 * Os usuários são poucos e conhecidos, cadastrados manualmente com
 * `npm run user:create` — não há registro público (CLAUDE.md, seção 6).
 * Sessão em JWT para dispensar as tabelas de sessão do adapter.
 *
 * A proteção só entra em vigor quando AUTH_SECRET está definida; sem ela a
 * aplicação roda aberta, o que mantém o desenvolvimento local sem setup.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { verifyPassword } from "@/lib/auth-password";
import { getPrisma } from "@/lib/db";

export const authEnabled = Boolean(process.env.AUTH_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await getPrisma().user.findUnique({ where: { email } });
        if (!user || !verifyPassword(password, user.passwordHash)) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
