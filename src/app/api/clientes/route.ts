import { NextResponse } from "next/server";

import { listarClientes, listarClientesCompletos } from "@/lib/clientes";
import { permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * El maestro de clientes. Existe para los consumidores que no son la propia
 * página —el conector MCP— y repite la regla que ya aplican las pantallas:
 *
 *   - La ficha completa (NIT, etapa, observaciones, auditoría) es dato de
 *     terceros: sin alcance de equipo no se lee, igual que en
 *     `/dashboard/clientes`.
 *   - El selector básico (serial, nombre, ciudad) lo recibe cualquier sesión,
 *     igual que en `/dashboard/visitas`: sin él no se puede ni registrar una
 *     visita a nombre propio.
 *
 * `alcance` en la respuesta dice cuál de las dos vino, para que quien la lea no
 * confunda "el cliente no tiene NIT" con "no puedes ver el NIT".
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permisos = permisosDe(session);
  if (!permisos.leerPropio) {
    return NextResponse.json(
      { error: "Tu usuario no tiene un nivel de acceso asignado." },
      { status: 403 },
    );
  }

  try {
    if (permisos.verTodo) {
      return NextResponse.json({
        alcance: "completo",
        clientes: await listarClientesCompletos(),
      });
    }

    return NextResponse.json({
      alcance: "selector",
      clientes: await listarClientes(),
    });
  } catch (error) {
    console.error("listar clientes", error);
    return NextResponse.json(
      { error: "No pudimos leer los clientes." },
      { status: 502 },
    );
  }
}
