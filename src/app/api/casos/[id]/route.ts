import { NextResponse } from "next/server";

import {
  cambiarEstadoCaso,
  ESTADOS_CASO,
  reprogramarLimite,
  type EstadoCaso,
} from "@/lib/casos";
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

      return NextResponse.json({
        caso: await cambiarEstadoCaso(id, estado as EstadoCaso, observaciones),
      });
    }

    if (body?.accion === "reprogramar") {
      const fecha = typeof body.fecha === "string" ? body.fecha : "";
      if (!FECHA.test(fecha)) {
        return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
      }

      return NextResponse.json({ caso: await reprogramarLimite(id, fecha) });
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
