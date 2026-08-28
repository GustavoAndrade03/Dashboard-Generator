import { handlers } from "@/auth";

/** O provider Credentials consulta o Prisma: precisa do runtime Node. */
export const runtime = "nodejs";

export const { GET, POST } = handlers;
