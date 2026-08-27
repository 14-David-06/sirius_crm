import { redirect } from "next/navigation";

import { listarClientesCompletos, listarContactos } from "@/lib/clientes";
import { hoyEnBogota, listarVisitas } from "@/lib/crm";
import { getSession } from "@/lib/session";
import { Shell } from "../shell";
import { ListaClientes, type FilaCliente } from "./lista";

// El maestro de clientes cambia durante el día: siempre se lee fresco.
export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [clientes, contactos, visitas] = await Promise.all([
    listarClientesCompletos(),
    listarContactos(),
    listarVisitas(),
  ]);

  const hoy = hoyEnBogota();

  const contactosPorCliente = new Map<string, number>();
  for (const contacto of contactos) {
    if (!contacto.activo) continue;
    for (const recordId of contacto.clientes) {
      contactosPorCliente.set(
        recordId,
        (contactosPorCliente.get(recordId) ?? 0) + 1,
      );
    }
  }

  const filas: FilaCliente[] = clientes.map((cliente) => {
    // Las visitas guardan el serial del cliente ("CL-0007"), no el record id.
    const suyas = visitas.filter(
      (visita) =>
        (cliente.id && visita.idClienteCore === cliente.id) ||
        visita.cliente === cliente.nombre,
    );

    const fechas = suyas
      .map((visita) => visita.fecha)
      .filter((fecha): fecha is string => Boolean(fecha))
      .sort();

    return {
      recordId: cliente.recordId,
      id: cliente.id,
      nombre: cliente.nombre,
      nit: cliente.nit,
      ciudad: cliente.ciudad,
      departamento: cliente.departamento,
      activo: cliente.activo,
      contactos: contactosPorCliente.get(cliente.recordId) ?? 0,
      visitas: suyas.length,
      ultimaVisita: fechas.at(-1) ?? null,
      seguimientoAtrasado: suyas.some(
        (visita) =>
          visita.fechaSeguimiento && visita.fechaSeguimiento.slice(0, 10) < hoy,
      ),
    };
  });

  return (
    <Shell nombre={session.nombre} rol={session.rol}>
      <ListaClientes filas={filas} />
    </Shell>
  );
}
