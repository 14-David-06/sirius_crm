import { redirect } from "next/navigation";

import { listarPersonalActivo } from "@/lib/airtable";
import { listarClientes } from "@/lib/clientes";
import { listarCasosPendientes } from "@/lib/casos";
import { hoyEnBogota, listarVisitas } from "@/lib/crm";
import { listarProductosActivos } from "@/lib/productos";
import { filtrarPorAlcance, permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";
import { transcripcionConfigurada } from "@/lib/transcripcion";
import { Shell } from "../shell";
import { ModuloVisitas } from "./modulo";

export const dynamic = "force-dynamic";

export default async function VisitasPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [visitas, casos, clientes, productos, personal] = await Promise.all([
    listarVisitas(),
    listarCasosPendientes(),
    listarClientes(),
    listarProductosActivos(),
    listarPersonalActivo(),
  ]);

  // Quien no puede ver datos de terceros solo ve lo que tiene a su nombre.
  const permisos = permisosDe(session);
  const mias = filtrarPorAlcance(visitas, permisos, session);
  const misCasos = filtrarPorAlcance(casos, permisos, session);

  const elegibles = permisos.verTodo
    ? personal
    : personal.filter((p) => p.idEmpleado === session.idEmpleado);

  return (
    <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
      <ModuloVisitas
        visitas={mias}
        casos={misCasos}
        clientes={clientes}
        productos={productos}
        personal={elegibles}
        sesion={{
          idEmpleado: session.idEmpleado,
          nombre: session.nombre,
        }}
        hoy={hoyEnBogota()}
        transcripcionDisponible={transcripcionConfigurada()}
        permisos={permisos}
      />
    </Shell>
  );
}
