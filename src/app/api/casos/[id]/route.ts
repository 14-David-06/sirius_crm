import { NextResponse } from "next/server";

import {
  cambiarEstadoCaso,
  ESTADOS_CASO,
  obtenerCaso,
  reprogramarLimite,
  type EstadoCaso,
} from "@/lib/casos";
import { permisosDe, puedeEditar } from "@/lib/permisos";
import { ETIQUETAS, invalidar } from "@/lib/cache";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

/** Cambia el estado de un caso o mueve su fecha límite. */
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
    return NextResponse.json({ error: "Caso inválido." }, { status: 400 });
  }

  // El permiso se resuelve contra el registro real, no contra lo que mande
  // el cliente: es la única comprobación que un curl no puede saltarse.
  const caso = await obtenerCaso(id);
  if (!caso) {
    return NextResponse.json({ error: "El caso no existe." }, { status: 404 });
  }
  if (!puedeEditar(permisosDe(session), caso, session)) {
    return NextResponse.json(
      { error: "Este caso no está a tu nombre y tu nivel no permite editarlo." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    accion?: unknown;
    estado?: unknown;
    fecha?: unknown;
    observaciones?: unknown;
  } | null;

  try {
    if (body?.accion === "estado") {
      const estado = typeof body.estado === "string" ? body.estado : "";
      if (!ESTADOS_CASO.includes(estado as EstadoCaso)) {
        return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
      }

      const observaciones =
        typeof body.observaciones === "string" && body.observaciones.trim()
          ? body.observaciones.trim()
          : null;

      const actualizado = await cambiarEstadoCaso(
        id,
        estado as EstadoCaso,
        observaciones,
        session.idEmpleado,
      );
      invalidar(ETIQUETAS.casos);
      return NextResponse.json({ caso: actualizado });
    }

    if (body?.accion === "reprogramar") {
      const fecha = typeof body.fecha === "string" ? body.fecha : "";
      if (!FECHA.test(fecha)) {
        return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
      }

      const movido = await reprogramarLimite(id, fecha, session.idEmpleado);
      invalidar(ETIQUETAS.casos);
      return NextResponse.json({ caso: movido });
    }

    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  } catch (error) {
    console.error("actualizar caso", error);
    return NextResponse.json(
      { error: "No pudimos actualizar el caso." },
      { status: 502 },
    );
  }
}
