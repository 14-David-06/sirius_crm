import { redirect } from "next/navigation";

import { listarPersonalActivo } from "@/lib/airtable";
import { listarClientes, listarCultivos } from "@/lib/clientes";
import { hoyEnBogota } from "@/lib/crm";
import { permisosDe } from "@/lib/permisos";
import { listarProductos } from "@/lib/productos";
import { listarProyectos, listarTareasProyecto } from "@/lib/proyectos";
import {
  calcularAvance,
  participaEnProyecto,
  proyectoAtrasado,
} from "@/lib/proyectos-comun";
import { getSession } from "@/lib/session";
import { Shell } from "../shell";
import { ModuloProyectos, type FilaProyecto } from "./modulo";

export const dynamic = "force-dynamic";

export default async function ProyectosPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [proyectos, tareas, clientes, cultivos, productos, personal] =
    await Promise.all([
      listarProyectos(),
      listarTareasProyecto(),
      listarClientes(),
      listarCultivos(),
      listarProductos(),
      listarPersonalActivo(),
    ]);

  const permisos = permisosDe(session);
  const hoy = hoyEnBogota();

  // Se arma aquí, en el servidor, para no mandarle al navegador tareas de
  // proyectos que esta sesión no puede ver.
  const filas: FilaProyecto[] = proyectos.flatMap((proyecto) => {
    const suyas = tareas.filter((t) => t.proyecto === proyecto.recordId);
    if (!participaEnProyecto(permisos, proyecto, suyas, session)) return [];
    return [
      {
        proyecto,
        avance: calcularAvance(suyas, hoy),
        atrasado: proyectoAtrasado(proyecto, hoy),
        misTareasAbiertas: suyas.filter(
          (t) =>
            t.idPersonalCore === session.idEmpleado &&
            t.estado !== "Completada" &&
            t.estado !== "Cancelada",
        ).length,
      },
    ];
  });

  return (
    <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
      <ModuloProyectos
        filas={filas}
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
        hoy={hoy}
        permisos={permisos}
      />
    </Shell>
  );
}
