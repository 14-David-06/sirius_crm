import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

import { SESSION_COOKIE } from "@/lib/session";

/**
 * Corre en el edge runtime, así que solo verifica el JWT de la cookie
 * (jose es compatible); bcrypt y Airtable se quedan en las rutas de API.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;

  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      return NextResponse.next();
    } catch {
      // Token vencido o inválido: se trata como sesión ausente.
    }
  }

  const login = new URL("/login", request.url);
  const response = NextResponse.redirect(login);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
