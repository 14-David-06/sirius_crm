import { notFound, redirect } from "next/navigation";

import { listarPersonalActivo } from "@/lib/airtable";
import { listarClientes, listarCultivos } from "@/lib/clientes";
import { hoyEnBogota } from "@/lib/crm";
import { permisosDe } from "@/lib/permisos";
import { listarProductos } from "@/lib/productos";
import { listarProyectos, listarTareasProyecto } from "@/lib/proyectos";
import {
  participaEnProyecto,
  puedeAvanzarTarea,
  puedeGestionarProyecto,
} from "@/lib/proyectos-comun";
import { getSession } from "@/lib/session";
import { Shell } from "../../shell";
import { FichaProyecto } from "./ficha";

export const dynamic = "force-dynamic";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

export default async function ProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  if (!RECORD_ID.test(id)) {
    notFound();
  }

  const [proyectos, todasLasTareas, clientes, cultivos, productos, personal] =
    await Promise.all([
      listarProyectos(),
      listarTareasProyecto(),
      listarClientes(),
      listarCultivos(),
      listarProductos(),
      listarPersonalActivo(),
    ]);

  const proyecto = proyectos.find((p) => p.recordId === id);
  if (!proyecto) {
    notFound();
  }

  const permisos = permisosDe(session);
  const tareas = todasLasTareas.filter((t) => t.proyecto === proyecto.recordId);

  // Un proyecto ajeno responde igual que uno inexistente: no se confirma que
  // existe a quien no participa en él.
  if (!participaEnProyecto(permisos, proyecto, tareas, session)) {
    notFound();
  }

  const gestiona = puedeGestionarProyecto(permisos, proyecto, session);

  return (
    <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
      <FichaProyecto
        proyecto={proyecto}
        tareas={tareas.map((tarea) => ({
          ...tarea,
          puedeAvanzar: puedeAvanzarTarea(permisos, proyecto, tarea, session),
        }))}
        clientes={clientes}
        cultivos={cultivos.map((c) => ({ nombre: c.nombre, clientes: c.clientes }))}
        productos={productos.map((p) => ({
          codigo: p.codigo,
          nombre: p.nombre,
          activo: p.activo,
        }))}
        personal={personal.map((p) => ({
          nombre: p.nombre,
          idEmpleado: p.idEmpleado,
        }))}
        sesion={{ idEmpleado: session.idEmpleado, nombre: session.nombre }}
        gestiona={gestiona}
        // Anotar en la bitácora: cualquiera que participe y pueda escribir.
        puedeAnotar={gestiona || permisos.actualizarPropio}
        puedeCambiarLider={permisos.actualizarTodo}
        hoy={hoyEnBogota()}
      />
    </Shell>
  );
}
