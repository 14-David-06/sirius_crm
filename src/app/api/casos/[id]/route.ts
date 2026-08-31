import { NextResponse } from "next/server";

import {
  actualizarCaso,
  cambiarEstadoCaso,
  ESTADOS_CASO,
  exigeSolucion,
  obtenerCaso,
  reprogramarLimite,
  TIPOS_CASO,
  type EstadoCaso,
  type TipoCaso,
} from "@/lib/casos";
import { permisosDe, puedeEditar } from "@/lib/permisos";
import { ETIQUETAS, invalidar } from "@/lib/cache";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

/** Corrige un caso, cambia su estado o mueve su fecha límite. */
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
  // Además es el estado "antes" con el que se anota la bitácora.
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

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  try {
    if (body?.accion === "estado") {
      const estado = cadena(body.estado) ?? "";
      if (!ESTADOS_CASO.includes(estado as EstadoCaso)) {
        return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
      }

      // Cerrar sin decir qué se le respondió al cliente deja un registro
      // inservible: dentro de un mes nadie sabrá cómo se resolvió.
      const solucion = cadena(body.solucionFinal);
      if (exigeSolucion(estado) && !solucion && !caso.solucionFinal) {
        return NextResponse.json(
          {
            error:
              "Para resolver o cerrar el caso, escribe la solución o respuesta final que se le dio al cliente.",
          },
          { status: 400 },
        );
      }

      const actualizado = await cambiarEstadoCaso(
        caso,
        estado as EstadoCaso,
        cadena(body.observaciones),
        session.idEmpleado,
        solucion,
      );
      invalidar(ETIQUETAS.casos);
      return NextResponse.json({ caso: actualizado });
    }

    if (body?.accion === "reprogramar") {
      const fecha = cadena(body.fecha) ?? "";
      if (!FECHA.test(fecha)) {
        return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
      }
      if (caso.fechaApertura && fecha < caso.fechaApertura) {
        return NextResponse.json(
          { error: "La fecha límite no puede ser anterior a la apertura." },
          { status: 400 },
        );
      }

      const movido = await reprogramarLimite(caso, fecha, session.idEmpleado);
      invalidar(ETIQUETAS.casos);
      return NextResponse.json({ caso: movido });
    }

    if (body?.accion === "datos") {
      const tipo = cadena(body.tipo);
      const descripcion = cadena(body.descripcion);
      const fechaLimite = cadena(body.fechaLimite);

      if (!tipo || !TIPOS_CASO.includes(tipo as TipoCaso)) {
        return NextResponse.json(
          { error: "Tipo de requerimiento inválido." },
          { status: 400 },
        );
      }
      if (!descripcion) {
        return NextResponse.json(
          { error: "Describe el requerimiento del cliente." },
          { status: 400 },
        );
      }
      if (fechaLimite && !FECHA.test(fechaLimite)) {
        return NextResponse.json(
          { error: "Fecha límite inválida." },
          { status: 400 },
        );
      }
      if (
        fechaLimite &&
        caso.fechaApertura &&
        fechaLimite < caso.fechaApertura
      ) {
        return NextResponse.json(
          { error: "La fecha límite no puede ser anterior a la apertura." },
          { status: 400 },
        );
      }

      // Un caso ya cerrado no puede quedarse sin la respuesta que lo cerró.
      const solucionFinal = cadena(body.solucionFinal);
      if (exigeSolucion(caso.estado) && !solucionFinal) {
        return NextResponse.json(
          {
            error:
              "Este caso está cerrado: no puedes dejarlo sin solución o respuesta final.",
          },
          { status: 400 },
        );
      }

      const actualizado = await actualizarCaso(
        caso,
        {
          idContactoCore: cadena(body.idContactoCore),
          tipo: tipo as TipoCaso,
          descripcion,
          fechaLimite,
          seguimiento: cadena(body.seguimiento),
          solucionFinal,
          observaciones: cadena(body.observaciones),
        },
        session.idEmpleado,
      );
      invalidar(ETIQUETAS.casos);
      return NextResponse.json({ caso: actualizado });
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

function cadena(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}
