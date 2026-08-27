import { redirect } from "next/navigation";

import { listarPersonalActivo } from "@/lib/airtable";
import {
  hoyEnBogota,
  listarCasosPendientes,
  listarClientes,
  listarProductos,
  listarVisitas,
} from "@/lib/crm";
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
    listarProductos(),
    listarPersonalActivo(),
  ]);

  return (
    <Shell nombre={session.nombre} rol={session.rol}>
      <ModuloVisitas
        visitas={visitas}
        casos={casos}
        clientes={clientes}
        productos={productos}
        personal={personal}
        usuario={session.nombre}
        hoy={hoyEnBogota()}
        transcripcionDisponible={transcripcionConfigurada()}
      />
    </Shell>
  );
}
