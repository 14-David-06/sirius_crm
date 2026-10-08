import { NextResponse } from "next/server";

import { esErrorAutoria, resolverAutoria } from "@/lib/autoria";
import { ETIQUETAS, invalidar } from "@/lib/cache";
import { permisosDe } from "@/lib/permisos";
import { listarProductos } from "@/lib/productos";
import {
  crearProyecto,
  listarProyectos,
  listarTareasProyecto,
} from "@/lib/proyectos";
import {
  esErrorEntrada,
  ESTADOS_PROYECTO,
  leerDatosProyecto,
  participaEnProyecto,
  proyectoCerrado,
  type EstadoProyecto,
} from "@/lib/proyectos-comun";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permisos = permisosDe(session);

  try {
    const [proyectos, tareas] = await Promise.all([
      listarProyectos(),
      listarTareasProyecto(),
    ]);
    return NextResponse.json({
      proyectos: proyectos.filter((proyecto) =>
        participaEnProyecto(
          permisos,
          proyecto,
          tareas.filter((tarea) => tarea.proyecto === proyecto.recordId),
          session,
        ),
      ),
    });
  } catch (error) {
    console.error("listar proyectos", error);
    return NextResponse.json(
      { error: "No pudimos leer los proyectos." },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permisos = permisosDe(session);
  if (!permisos.crear) {
    return NextResponse.json(
      { error: "Tu nivel de acceso no permite crear proyectos." },
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

  const cliente = cadena(body.cliente);
  if (!cliente) {
    return NextResponse.json({ error: "Elige un cliente." }, { status: 400 });
  }

  const estado = cadena(body.estado) ?? "Planeación";
  if (!ESTADOS_PROYECTO.includes(estado as EstadoProyecto)) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }
  // Un proyecto nuevo se crea para ejecutarlo: nacer cerrado no tiene sentido.
  if (proyectoCerrado(estado)) {
    return NextResponse.json(
      { error: "Un proyecto nuevo no puede nacer finalizado ni cancelado." },
      { status: 400 },
    );
  }

  try {
    const datos = leerDatosProyecto(body, await listarProductos());
    if (esErrorEntrada(datos)) {
      return NextResponse.json({ error: datos.error }, { status: 400 });
    }

    const autoria = await resolverAutoria(session, permisos, {
      id: cadena(body.liderId),
      nombre: null,
    });
    if (esErrorAutoria(autoria)) {
      return NextResponse.json(
        { error: autoria.error },
        { status: autoria.status },
      );
    }

    const proyecto = await crearProyecto({
      ...datos,
      idClienteCore: cadena(body.idClienteCore),
      cliente,
      estado: estado as EstadoProyecto,
      responsable: autoria.responsable,
      idPersonalCore: autoria.idPersonalCore,
      autorId: session.idEmpleado,
    });

    invalidar(ETIQUETAS.proyectos);
    return NextResponse.json({ proyecto }, { status: 201 });
  } catch (error) {
    console.error("crear proyecto", error);
    return NextResponse.json(
      { error: "No pudimos guardar el proyecto en Airtable." },
      { status: 502 },
    );
  }
}

function cadena(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}
