import { NextResponse } from "next/server";

import { ETIQUETAS, invalidar } from "@/lib/cache";
import {
  actualizarVisita,
  esErrorVisita,
  obtenerVisita,
  revisarVisita,
} from "@/lib/crm";
import { permisosDe, puedeEditar } from "@/lib/permisos";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

/**
 * Corrige una visita ya registrada.
 *
 * El cliente y el responsable no se tocan aquí: el primero porque una visita
 * hecha a otra empresa es otra visita, no una corrección; el segundo porque es
 * la clave de propiedad con la que este mismo endpoint decide el permiso.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  if (!RECORD_ID.test(id)) {
    return NextResponse.json({ error: "Visita inválida." }, { status: 400 });
  }

  // El permiso se resuelve contra el registro real, sin pasar por el caché:
  // un dato viejo dejaría editar una visita que ya cambió de dueño.
  const visita = await obtenerVisita(id);
  if (!visita) {
    return NextResponse.json({ error: "La visita no existe." }, { status: 404 });
  }
  if (!puedeEditar(permisosDe(session), visita, session)) {
    return NextResponse.json(
      {
        error: "Esta visita no está a tu nombre y tu nivel no permite editarla.",
      },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const revisada = revisarVisita({
    fecha: cadena(body.fecha),
    objetivo: cadena(body.objetivo),
    tipo: cadena(body.tipo),
    resultado: cadena(body.resultado),
    proximaAccion: cadena(body.proximaAccion),
    fechaSeguimiento: cadena(body.fechaSeguimiento),
  });
  if (esErrorVisita(revisada)) {
    return NextResponse.json({ error: revisada.error }, { status: 400 });
  }

  try {
    const actualizada = await actualizarVisita(
      id,
      {
        idContactoCore: cadena(body.idContactoCore),
        fecha: revisada.datos.fecha,
        tipo: revisada.datos.tipo,
        objetivo: revisada.datos.objetivo,
        necesidad: cadena(body.necesidad),
        idProductosCore: cadena(body.idProductosCore),
        productos: cadena(body.productos),
        resultado: revisada.datos.resultado,
        proximaAccion: revisada.datos.proximaAccion,
        fechaSeguimiento: revisada.datos.fechaSeguimiento,
        pendientes: cadena(body.pendientes),
        observaciones: cadena(body.observaciones),
      },
      session.idEmpleado,
    );

    invalidar(ETIQUETAS.visitas);
    return NextResponse.json({ visita: actualizada });
  } catch (error) {
    console.error("actualizar visita", error);
    return NextResponse.json(
      { error: "No pudimos guardar los cambios de la visita." },
      { status: 502 },
    );
  }
}

function cadena(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}
