import { NextResponse } from "next/server";

import { describirPermisos, permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Quién es la sesión y qué puede hacer.
 *
 * Es la primera llamada de cualquier cliente que no sea el dashboard: saber el
 * nivel de acceso antes de intentar algo evita el 403 y, sobre todo, permite
 * explicar el motivo. Nunca devuelve la cédula ni nada que sirva para entrar.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permisos = permisosDe(session);

  return NextResponse.json({
    sesion: {
      nombre: session.nombre,
      idEmpleado: session.idEmpleado,
      rol: session.rol,
      nivelAcceso: session.nivelAcceso,
    },
    permisos,
    puede: describirPermisos(permisos),
  });
}
