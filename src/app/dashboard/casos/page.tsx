import { redirect } from "next/navigation";

import { listarPersonalActivo } from "@/lib/airtable";
import { listarCasos } from "@/lib/casos";
import { listarClientes } from "@/lib/clientes";
import { hoyEnBogota, listarVisitas } from "@/lib/crm";
import { filtrarPorAlcance, permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";
import { Shell } from "../shell";
import { ModuloCasos } from "./modulo";

// Los casos cambian de estado durante el día: nunca se sirven cacheados.
export const dynamic = "force-dynamic";

export default async function CasosPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [casos, clientes, visitas, personal] = await Promise.all([
    listarCasos(),
    listarClientes(),
    listarVisitas(),
    listarPersonalActivo(),
  ]);

  const permisos = permisosDe(session);
  const mios = filtrarPorAlcance(casos, permisos, session);

  // El selector de visita de origen solo necesita lo justo para identificarla,
  // y solo puede ofrecer visitas que esta sesión tiene permitido ver.
  const origenes = filtrarPorAlcance(visitas, permisos, session).map(
    (visita) => ({
    recordId: visita.recordId,
    idClienteCore: visita.idClienteCore,
    cliente: visita.cliente,
    fecha: visita.fecha,
    objetivo: visita.objetivo,
  }));

  const elegibles = permisos.verTodo
    ? personal
    : personal.filter((p) => p.idEmpleado === session.idEmpleado);

  return (
    <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
      <ModuloCasos
        casos={mios}
        clientes={clientes}
        visitas={origenes}
        personal={elegibles}
        sesion={{
          idEmpleado: session.idEmpleado,
          nombre: session.nombre,
        }}
        hoy={hoyEnBogota()}
        permisos={permisos}
      />
    </Shell>
  );
}
