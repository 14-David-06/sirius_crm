import { redirect } from "next/navigation";

import { listarPersonalActivo } from "@/lib/airtable";
import { listarCasos } from "@/lib/casos";
import { listarClientes } from "@/lib/clientes";
import { hoyEnBogota, listarVisitas } from "@/lib/crm";
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

  // El selector de visita de origen solo necesita lo justo para identificarla.
  const origenes = visitas.map((visita) => ({
    recordId: visita.recordId,
    idClienteCore: visita.idClienteCore,
    cliente: visita.cliente,
    fecha: visita.fecha,
    objetivo: visita.objetivo,
  }));

  return (
    <Shell nombre={session.nombre} rol={session.rol}>
      <ModuloCasos
        casos={casos}
        clientes={clientes}
        visitas={origenes}
        personal={personal}
        usuario={session.nombre}
        hoy={hoyEnBogota()}
      />
    </Shell>
  );
}
