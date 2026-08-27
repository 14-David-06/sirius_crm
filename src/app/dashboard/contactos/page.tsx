import { redirect } from "next/navigation";

import { listarClientesCompletos, listarContactos } from "@/lib/clientes";
import { permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";
import { Shell } from "../shell";
import { SinAcceso } from "../sin-acceso";
import { ModuloContactos, type FilaContacto } from "./modulo";

// El directorio se lee fresco: los teléfonos se corrigen desde esta misma vista.
export const dynamic = "force-dynamic";

export default async function ContactosPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // El maestro es dato de terceros: sin alcance de equipo no se lee siquiera.
  const permisos = permisosDe(session);
  if (!permisos.verTodo) {
    return (
      <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
        <SinAcceso modulo="Contactos" permisos={permisos} />
      </Shell>
    );
  }

  const [contactos, clientes] = await Promise.all([
    listarContactos(),
    listarClientesCompletos(),
  ]);

  const porRecordId = new Map(clientes.map((c) => [c.recordId, c]));

  const filas: FilaContacto[] = contactos.map((contacto) => {
    // Un contacto puede estar vinculado a varios clientes; hoy todos tienen uno.
    const suyos = contacto.clientes
      .map((recordId) => porRecordId.get(recordId))
      .filter((cliente): cliente is NonNullable<typeof cliente> =>
        Boolean(cliente),
      );

    return {
      recordId: contacto.recordId,
      codigo: contacto.codigo,
      nombre: contacto.nombre,
      cargo: contacto.cargo,
      cedula: contacto.cedula,
      email: contacto.email,
      telefono: contacto.telefono,
      activo: contacto.activo,
      clientes: suyos.map((cliente) => ({
        recordId: cliente.recordId,
        nombre: cliente.nombre,
        ciudad: cliente.ciudad,
        activo: cliente.activo,
      })),
    };
  });

  const paraSelector = clientes
    .filter((cliente) => cliente.activo)
    .map((cliente) => ({
      recordId: cliente.recordId,
      nombre: cliente.nombre,
      ciudad: cliente.ciudad,
    }));

  return (
    <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
      <ModuloContactos filas={filas} clientes={paraSelector} />
    </Shell>
  );
}
