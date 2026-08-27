import { NextResponse } from "next/server";

import {
  cerrarSeguimiento,
  hoyEnBogota,
  obtenerVisita,
  reprogramarSeguimiento,
} from "@/lib/crm";
import { permisosDe, puedeEditar } from "@/lib/permisos";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

/** Reprograma o cierra el compromiso de seguimiento de una visita. */
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

  // El permiso se resuelve contra el registro real de Airtable.
  const visita = await obtenerVisita(id);
  if (!visita) {
    return NextResponse.json({ error: "La visita no existe." }, { status: 404 });
  }
  if (!puedeEditar(permisosDe(session), visita, session)) {
    return NextResponse.json(
      {
        error:
          "Esta visita no está a tu nombre y tu nivel no permite editarla.",
      },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    accion?: unknown;
    fecha?: unknown;
    nota?: unknown;
    observaciones?: unknown;
  } | null;

  try {
    if (body?.accion === "reprogramar") {
      const fecha = typeof body.fecha === "string" ? body.fecha : "";
      if (!FECHA.test(fecha)) {
        return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
      }
      return NextResponse.json({
        visita: await reprogramarSeguimiento(id, fecha, session.idEmpleado),
      });
    }

    if (body?.accion === "cumplido") {
      const nota =
        typeof body.nota === "string" && body.nota.trim()
          ? body.nota.trim()
          : `cerrado por ${session.nombre}`;
      const observaciones =
        typeof body.observaciones === "string" ? body.observaciones : null;

      return NextResponse.json({
        visita: await cerrarSeguimiento(
          id,
          nota,
          observaciones,
          hoyEnBogota(),
          session.idEmpleado,
        ),
      });
    }

    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  } catch (error) {
    console.error("actualizar seguimiento", error);
    return NextResponse.json(
      { error: "No pudimos actualizar el seguimiento." },
      { status: 502 },
    );
  }
}
