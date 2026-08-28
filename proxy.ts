/**
 * Proteção de rotas.
 *
 * No Next 16 o antigo `middleware` passou a se chamar `proxy` e roda sempre no
 * runtime Node — o que aqui é conveniente, porque a verificação de sessão
 * acaba do mesmo lado que o Prisma.
 *
 * Sem AUTH_SECRET a aplicação fica aberta de propósito: é o modo de
 * desenvolvimento local, sem banco e sem cadastro.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth, authEnabled } from "@/auth";

export async function proxy(request: NextRequest) {
  if (!authEnabled) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/login")) return NextResponse.next();

  const session = await auth();
  if (session?.user) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Tudo, exceto os assets do Next, os arquivos estáticos e as rotas do Auth.js.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
