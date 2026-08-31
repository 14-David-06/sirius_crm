import { redirect } from "next/navigation";

import { listarPersonalActivo } from "@/lib/airtable";
import { listarClientes, listarContactos } from "@/lib/clientes";
import { listarCasosPendientes } from "@/lib/casos";
import { hoyEnBogota, listarVisitas } from "@/lib/crm";
import { listarProductos } from "@/lib/productos";
import { filtrarPorAlcance, permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";
import { transcripcionConfigurada } from "@/lib/transcripcion";
import { Shell } from "../shell";
import { ModuloVisitas, type ContactoVisita } from "./modulo";

export const dynamic = "force-dynamic";

export default async function VisitasPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [visitas, casos, clientes, contactos, productos, personal] =
    await Promise.all([
      listarVisitas(),
      listarCasosPendientes(),
      listarClientes(),
      listarContactos(),
      listarProductos(),
      listarPersonalActivo(),
    ]);

  // Solo los que tienen serial: es la llave con la que la visita los guarda.
  const paraSelector: ContactoVisita[] = contactos
    .filter((contacto) => contacto.codigo)
    .map((contacto) => ({
      codigo: contacto.codigo as string,
      nombre: contacto.nombre,
      funciones: contacto.funciones,
      activo: contacto.activo,
      clientes: contacto.clientes,
    }));

  // Quien no puede ver datos de terceros solo ve lo que tiene a su nombre.
  const permisos = permisosDe(session);
  const mias = filtrarPorAlcance(visitas, permisos, session);
  const misCasos = filtrarPorAlcance(casos, permisos, session);

  return (
    <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
      <ModuloVisitas
        visitas={mias}
        casos={misCasos}
        clientes={clientes}
        contactos={paraSelector}
        productos={productos}
        personal={personal}
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
