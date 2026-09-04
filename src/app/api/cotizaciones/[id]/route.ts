import { NextResponse } from "next/server";

import { ETIQUETAS, invalidar } from "@/lib/cache";
import {
  actualizarCotizacion,
  cierraCotizacion,
  estaCerradaCotizacion,
  obtenerCotizacion,
  siguientesEstadosCotizacion,
  type EstadoCotizacion,
} from "@/lib/cotizaciones";
import { hoyEnBogota } from "@/lib/crm";
import { permisosDe, puedeEditar } from "@/lib/permisos";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

/**
 * Mueve una cotización de estado.
 *
 * Es el único cambio que el CRM hace sobre una cotización emitida: el
 * contenido no se reescribe. Los saltos no son libres —una oferta que el
 * cliente nunca recibió no puede estar Aceptada—, así que el estado que llega
 * se valida contra los que salen de este estado y no contra la lista entera.
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
    return NextResponse.json({ error: "Cotización inválida." }, { status: 400 });
  }

  // El permiso se resuelve contra el registro real, sin pasar por el caché.
  const cotizacion = await obtenerCotizacion(id);
  if (!cotizacion) {
    return NextResponse.json(
      { error: "La cotización no existe." },
      { status: 404 },
    );
  }

  const permisos = permisosDe(session);
  const autor = {
    idPersonalCore: cotizacion.idPersonalCore,
    responsable: cotizacion.responsable,
  };
  if (!puedeEditar(permisos, autor, session)) {
    return NextResponse.json(
      {
        error:
          "Esta cotización no está a tu nombre y tu nivel no permite editarla.",
      },
      { status: 403 },
    );
  }

  if (estaCerradaCotizacion(cotizacion.estado)) {
    return NextResponse.json(
      {
        error: `La cotización ya está ${cotizacion.estado}. Para cambiar algo se emite una revisión, no se reabre.`,
      },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    estado?: unknown;
    motivoCierre?: unknown;
  } | null;

  const estado = typeof body?.estado === "string" ? body.estado.trim() : "";
  const posibles = siguientesEstadosCotizacion(cotizacion.estado);

  if (!posibles.includes(estado as EstadoCotizacion)) {
    return NextResponse.json(
      {
        error:
          posibles.length === 0
            ? "Esta cotización no admite más cambios de estado."
            : `Desde ${cotizacion.estado} solo puede pasar a: ${posibles.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const motivo =
    typeof body?.motivoCierre === "string" ? body.motivoCierre.trim() : "";

  // Saber por qué se ganó o se perdió es la única razón por la que un histórico
  // de cotizaciones sirve para algo más que reimprimir papeles.
  if (cierraCotizacion(estado) && !motivo) {
    return NextResponse.json(
      {
        error: `Para marcarla ${estado} necesitamos el motivo: qué dijo el cliente.`,
      },
      { status: 400 },
    );
  }

  const hoy = hoyEnBogota();

  try {
    const actualizada = await actualizarCotizacion(id, {
      estado: estado as EstadoCotizacion,
      // La fecha de envío se fija la primera vez y no se reescribe: es el día
      // desde el que se cuenta el seguimiento comercial.
      fechaEnvio:
        estado === "Enviada" && !cotizacion.fechaEnvio ? hoy : undefined,
      fechaCierre: cierraCotizacion(estado) ? hoy : undefined,
      motivoCierre: motivo || undefined,
      modificadoPor: session.idEmpleado,
    });

    invalidar(ETIQUETAS.cotizaciones);
    return NextResponse.json({ cotizacion: actualizada });
  } catch (error) {
    console.error("cambiar estado de cotizacion", error);
    return NextResponse.json(
      { error: "No pudimos actualizar la cotización." },
      { status: 502 },
    );
  }
}
