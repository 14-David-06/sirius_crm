import { NextResponse } from "next/server";

import { ETIQUETAS, invalidar } from "@/lib/cache";
import { permisosDe } from "@/lib/permisos";
import {
  crearTarea,
  obtenerProyecto,
  resolverEncargado,
} from "@/lib/proyectos";
import {
  esErrorEntrada,
  leerDatosTarea,
  proyectoCerrado,
  puedeGestionarProyecto,
} from "@/lib/proyectos-comun";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

/** Agrega una tarea al cronograma del proyecto. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  if (!RECORD_ID.test(id)) {
    return NextResponse.json({ error: "Proyecto inválido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const datos = leerDatosTarea(body);
  if (esErrorEntrada(datos)) {
    return NextResponse.json({ error: datos.error }, { status: 400 });
  }

  try {
    const proyecto = await obtenerProyecto(id);
    if (!proyecto) {
      return NextResponse.json(
        { error: "El proyecto no existe." },
        { status: 404 },
      );
    }
    if (!puedeGestionarProyecto(permisosDe(session), proyecto, session)) {
      return NextResponse.json(
        { error: "Solo el líder del proyecto puede agregar tareas." },
        { status: 403 },
      );
    }
    if (proyectoCerrado(proyecto.estado)) {
      return NextResponse.json(
        { error: "El proyecto está cerrado: reábrelo para agregar tareas." },
        { status: 400 },
      );
    }

    // Sin encargado elegido, la tarea queda a nombre de quien la crea.
    const encargado = await resolverEncargado(
      datos.idEncargado ?? session.idEmpleado,
    );
    if (!encargado) {
      return NextResponse.json(
        { error: "El encargado debe ser una persona activa del equipo." },
        { status: 400 },
      );
    }

    const tarea = await crearTarea(
      proyecto.recordId,
      {
        tarea: datos.tarea,
        descripcion: datos.descripcion,
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
        ...encargado,
        estado: "Pendiente",
      },
      session.idEmpleado,
    );

    invalidar(ETIQUETAS.proyectos);
    return NextResponse.json({ tarea }, { status: 201 });
  } catch (error) {
    console.error("crear tarea de proyecto", error);
    return NextResponse.json(
      { error: "No pudimos guardar la tarea en Airtable." },
      { status: 502 },
    );
  }
}
