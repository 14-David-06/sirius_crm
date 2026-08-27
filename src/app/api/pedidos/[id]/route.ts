import { NextResponse } from "next/server";

import { ETIQUETAS, invalidar } from "@/lib/cache";
import {
  cambiarEstadoPedido,
  ESTADOS_PEDIDO,
  estaCerradoPedido,
  obtenerPedido,
  type EstadoPedido,
} from "@/lib/pedidos";
import { permisosDe, puedeEditar } from "@/lib/permisos";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

/** Mueve un pedido de estado. Es el único cambio que el CRM hace sobre uno. */
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
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  // El permiso se resuelve contra el registro real, sin pasar por el caché.
  const pedido = await obtenerPedido(id);
  if (!pedido) {
    return NextResponse.json({ error: "El pedido no existe." }, { status: 404 });
  }

  const permisos = permisosDe(session);
  const autor = {
    idPersonalCore: pedido.idPersonalCore,
    responsable: pedido.responsable,
  };
  if (!puedeEditar(permisos, autor, session)) {
    return NextResponse.json(
      {
        error:
          "Este pedido no está a tu nombre y tu nivel no permite editarlo.",
      },
      { status: 403 },
    );
  }

  if (estaCerradoPedido(pedido.estado)) {
    return NextResponse.json(
      {
        error: `El pedido ya está ${pedido.estado} y no admite más cambios.`,
      },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    estado?: unknown;
  } | null;

  const estado = typeof body?.estado === "string" ? body.estado.trim() : "";
  if (!ESTADOS_PEDIDO.includes(estado as EstadoPedido)) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }
  if (estado === pedido.estado) {
    return NextResponse.json(
      { error: "El pedido ya está en ese estado." },
      { status: 400 },
    );
  }

  try {
    const actualizado = await cambiarEstadoPedido(id, estado as EstadoPedido);
    invalidar(ETIQUETAS.pedidos);
    return NextResponse.json({ pedido: actualizado });
  } catch (error) {
    console.error("cambiar estado de pedido", error);
    return NextResponse.json(
      { error: "No pudimos actualizar el pedido." },
      { status: 502 },
    );
  }
}
