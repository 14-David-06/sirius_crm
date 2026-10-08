import { NextResponse } from "next/server";

import { ETIQUETAS, invalidar } from "@/lib/cache";
import { permisosDe } from "@/lib/permisos";
import {
  actualizarTarea,
  avanzarTarea,
  listarTareasDe,
  obtenerProyecto,
  resolverEncargado,
} from "@/lib/proyectos";
import {
  esErrorEntrada,
  ESTADOS_TAREA,
  leerDatosTarea,
  puedeAvanzarTarea,
  puedeGestionarProyecto,
  type EstadoTarea,
} from "@/lib/proyectos-comun";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

/**
 * `accion: "estado"` mueve el avance y las notas: lo puede hacer el encargado.
 * `accion: "datos"` cambia qué, quién y cuándo: solo quien gestiona el
 * proyecto, porque reasignar o mover fechas es replanear el cronograma.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; tareaId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id, tareaId } = await params;
  if (!RECORD_ID.test(id) || !RECORD_ID.test(tareaId)) {
    return NextResponse.json({ error: "Tarea inválida." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const permisos = permisosDe(session);

  try {
    const [proyecto, tareas] = await Promise.all([
      obtenerProyecto(id),
      listarTareasDe(id),
    ]);
    const tarea = tareas.find((t) => t.recordId === tareaId);
    if (!proyecto || !tarea) {
      return NextResponse.json(
        { error: "La tarea no existe en este proyecto." },
        { status: 404 },
      );
    }

    if (body.accion === "estado") {
      if (!puedeAvanzarTarea(permisos, proyecto, tarea, session)) {
        return NextResponse.json(
          { error: "Esta tarea no está a tu nombre." },
          { status: 403 },
        );
      }
      const estado = cadena(body.estado) ?? "";
      if (!ESTADOS_TAREA.includes(estado as EstadoTarea)) {
        return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
      }
      const actualizada = await avanzarTarea(
        tarea,
        estado as EstadoTarea,
        typeof body.notas === "string" ? body.notas.trim() : null,
        session.idEmpleado,
      );
      invalidar(ETIQUETAS.proyectos);
      return NextResponse.json({ tarea: actualizada });
    }

    if (body.accion === "datos") {
      if (!puedeGestionarProyecto(permisos, proyecto, session)) {
        return NextResponse.json(
          { error: "Solo el líder del proyecto puede replanear tareas." },
          { status: 403 },
        );
      }
      const datos = leerDatosTarea(body);
      if (esErrorEntrada(datos)) {
        return NextResponse.json({ error: datos.error }, { status: 400 });
      }
      const encargado =
        datos.idEncargado && datos.idEncargado !== tarea.idPersonalCore
          ? await resolverEncargado(datos.idEncargado)
          : tarea.idPersonalCore && tarea.responsable
            ? {
                responsable: tarea.responsable,
                idPersonalCore: tarea.idPersonalCore,
              }
            : await resolverEncargado(datos.idEncargado);
      if (!encargado) {
        return NextResponse.json(
          { error: "El encargado debe ser una persona activa del equipo." },
          { status: 400 },
        );
      }
      const actualizada = await actualizarTarea(
        tarea,
        {
          tarea: datos.tarea,
          descripcion: datos.descripcion,
          fechaInicio: datos.fechaInicio,
          fechaFin: datos.fechaFin,
          ...encargado,
        },
        session.idEmpleado,
      );
      invalidar(ETIQUETAS.proyectos);
      return NextResponse.json({ tarea: actualizada });
    }

    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  } catch (error) {
    console.error("actualizar tarea de proyecto", error);
    return NextResponse.json(
      { error: "No pudimos actualizar la tarea." },
      { status: 502 },
    );
  }
}

function cadena(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}
