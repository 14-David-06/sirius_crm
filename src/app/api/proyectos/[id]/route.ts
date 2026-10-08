import { NextResponse } from "next/server";

import { ETIQUETAS, invalidar } from "@/lib/cache";
import { hoyEnBogota } from "@/lib/crm";
import { permisosDe } from "@/lib/permisos";
import { listarProductos } from "@/lib/productos";
import {
  actualizarProyecto,
  actualizarResultados,
  anotarBitacora,
  cambiarEstadoProyecto,
  listarTareasDe,
  obtenerProyecto,
  resolverEncargado,
} from "@/lib/proyectos";
import {
  alertaTarea,
  calcularAvance,
  esErrorEntrada,
  ESTADOS_PROYECTO,
  leerCierre,
  leerDatosProyecto,
  participaEnProyecto,
  proyectoAtrasado,
  puedeAvanzarTarea,
  puedeGestionarProyecto,
  type EstadoProyecto,
} from "@/lib/proyectos-comun";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

/**
 * Un proyecto con sus tareas, para quien participa en él. Lee sin caché: lo
 * pide quien está por escribir, y tiene que ver lo último.
 */
export async function GET(
  _request: Request,
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

  const permisos = permisosDe(session);

  try {
    const [proyecto, tareas] = await Promise.all([
      obtenerProyecto(id),
      listarTareasDe(id),
    ]);
    // Un proyecto ajeno responde igual que uno inexistente.
    if (!proyecto || !participaEnProyecto(permisos, proyecto, tareas, session)) {
      return NextResponse.json(
        { error: "El proyecto no existe o no participas en él." },
        { status: 404 },
      );
    }

    const hoy = hoyEnBogota();
    return NextResponse.json({
      proyecto: {
        ...proyecto,
        avance: calcularAvance(tareas, hoy),
        atrasado: proyectoAtrasado(proyecto, hoy),
      },
      tareas: tareas.map((tarea) => ({
        ...tarea,
        alerta: alertaTarea(tarea, hoy),
        puedeAvanzar: puedeAvanzarTarea(permisos, proyecto, tarea, session),
      })),
      puedeGestionar: puedeGestionarProyecto(permisos, proyecto, session),
    });
  } catch (error) {
    console.error("leer proyecto", error);
    return NextResponse.json(
      { error: "No pudimos leer el proyecto." },
      { status: 502 },
    );
  }
}

/**
 * Corrige el proyecto, cambia su estado o sus resultados, o anota un avance
 * en la bitácora.
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
    return NextResponse.json({ error: "Proyecto inválido." }, { status: 400 });
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
    // El permiso se resuelve contra el registro real, sin caché: es la única
    // comprobación que un curl no puede saltarse.
    const proyecto = await obtenerProyecto(id);
    if (!proyecto) {
      return NextResponse.json(
        { error: "El proyecto no existe." },
        { status: 404 },
      );
    }

    const gestiona = puedeGestionarProyecto(permisos, proyecto, session);

    if (body.accion === "bitacora") {
      // Cualquiera que participe puede anotar lo que hizo u observó: el
      // encargado de una aplicación es quien sabe cómo salió.
      const participa =
        permisos.actualizarPropio &&
        participaEnProyecto(
          permisos,
          proyecto,
          await listarTareasDe(proyecto.recordId),
          session,
        );
      if (!gestiona && !participa) {
        return NextResponse.json(
          { error: "No participas en este proyecto." },
          { status: 403 },
        );
      }
      const nota = cadena(body.nota);
      if (!nota) {
        return NextResponse.json(
          { error: "Escribe el avance." },
          { status: 400 },
        );
      }
      const actualizado = await anotarBitacora(proyecto, nota, session);
      invalidar(ETIQUETAS.proyectos);
      return NextResponse.json({ proyecto: actualizado });
    }

    if (!gestiona) {
      return NextResponse.json(
        {
          error:
            "Este proyecto no está a tu nombre y tu nivel no permite editarlo.",
        },
        { status: 403 },
      );
    }

    if (body.accion === "estado") {
      const estado = cadena(body.estado) ?? "";
      if (!ESTADOS_PROYECTO.includes(estado as EstadoProyecto)) {
        return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
      }
      const cierre = leerCierre(body, estado, proyecto);
      if (esErrorEntrada(cierre)) {
        return NextResponse.json({ error: cierre.error }, { status: 400 });
      }
      const actualizado = await cambiarEstadoProyecto(
        proyecto,
        estado as EstadoProyecto,
        cierre,
        session.idEmpleado,
      );
      invalidar(ETIQUETAS.proyectos);
      return NextResponse.json({ proyecto: actualizado });
    }

    if (body.accion === "resultados") {
      // Al corregir no se mira lo guardado: se está reemplazando, así que un
      // proyecto finalizado no puede quedar sin resultados ni veredicto.
      const cierre = leerCierre(body, proyecto.estado, {
        resultados: null,
        veredicto: null,
      });
      if (esErrorEntrada(cierre)) {
        return NextResponse.json({ error: cierre.error }, { status: 400 });
      }
      const actualizado = await actualizarResultados(
        proyecto,
        cierre,
        session.idEmpleado,
      );
      invalidar(ETIQUETAS.proyectos);
      return NextResponse.json({ proyecto: actualizado });
    }

    if (body.accion === "datos") {
      const datos = leerDatosProyecto(body, await listarProductos());
      if (esErrorEntrada(datos)) {
        return NextResponse.json({ error: datos.error }, { status: 400 });
      }

      // Cambiar de líder es cambiar de dueño: solo el mando lo hace.
      const liderId = cadena(body.liderId);
      let lider: { responsable: string; idPersonalCore: string } | undefined;
      if (liderId && liderId !== proyecto.idPersonalCore) {
        if (!permisos.actualizarTodo) {
          return NextResponse.json(
            { error: "Tu nivel no permite cambiar el líder del proyecto." },
            { status: 403 },
          );
        }
        const resuelto = await resolverEncargado(liderId);
        if (!resuelto) {
          return NextResponse.json(
            { error: "El líder debe ser una persona activa del equipo." },
            { status: 400 },
          );
        }
        lider = resuelto;
      }

      const actualizado = await actualizarProyecto(
        proyecto,
        { ...datos, lider },
        session.idEmpleado,
      );
      invalidar(ETIQUETAS.proyectos);
      return NextResponse.json({ proyecto: actualizado });
    }

    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  } catch (error) {
    console.error("actualizar proyecto", error);
    return NextResponse.json(
      { error: "No pudimos actualizar el proyecto." },
      { status: 502 },
    );
  }
}

function cadena(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}
