import { NextResponse } from "next/server";

import { cargarInicio } from "@/lib/inicio";
import { permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Los mismos KPIs, pendientes y paneles del home del dashboard.
 *
 * `cargarInicio` ya recorta todo al alcance de la sesión, así que aquí basta
 * con exigir sesión. Los casos completos se omiten: quien los quiera tiene
 * `/api/casos`, y repetirlos aquí solo engorda la respuesta.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const inicio = await cargarInicio(permisosDe(session), session);

  // `undefined` no sobrevive a JSON.stringify, así que esto es la forma corta
  // de devolver todo el resumen menos la lista completa de casos.
  return NextResponse.json({ ...inicio, casos: undefined });
}
