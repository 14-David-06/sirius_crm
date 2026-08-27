import { listarPersonalActivo } from "@/lib/airtable";
import { esPropio, type Permisos } from "@/lib/permisos";
import type { SessionPayload } from "@/lib/session";

/**
 * Resuelve a nombre de quién queda un registro nuevo y con qué ID de personal.
 *
 * El ID (`SIRIUS-PER-XXXX`) es la clave de propiedad: el nombre puede escribirse
 * distinto o cambiar, el ID no. Por eso nunca se acepta un ID que venga del
 * cliente — siempre se resuelve contra el personal activo de Sirius Nomina Core.
 */

export type Autoria = { responsable: string; idPersonalCore: string };

export type ErrorAutoria = { error: string; status: 400 | 403 };

export async function resolverAutoria(
  session: SessionPayload,
  permisos: Permisos,
  /** ID de empleado que eligió el formulario; el nombre es solo respaldo. */
  pedido: { id: string | null; nombre: string | null },
): Promise<Autoria | ErrorAutoria> {
  const propio =
    (pedido.id === null && pedido.nombre === null) ||
    (pedido.id !== null && pedido.id === session.idEmpleado) ||
    (pedido.id === null && esPropio(pedido.nombre, session.nombre));

  if (propio) {
    if (!session.idEmpleado) {
      return {
        error:
          "Tu usuario no tiene ID de empleado en Sirius Nomina Core, así que no podemos marcar la autoría del registro.",
        status: 400,
      };
    }
    return {
      responsable: session.nombre,
      idPersonalCore: session.idEmpleado,
    };
  }

  // Registrar a nombre de otra persona exige alcance de equipo.
  if (!permisos.verTodo) {
    return {
      error: "Solo puedes registrar a tu propio nombre.",
      status: 403,
    };
  }

  const personal = await listarPersonalActivo();
  // El ID es exacto; el nombre solo se usa si el formulario no mandó ID.
  const persona = pedido.id
    ? personal.find((p) => p.idEmpleado === pedido.id)
    : personal.find((p) => esPropio(p.nombre, pedido.nombre));

  if (!persona) {
    return {
      error:
        "El responsable debe ser una persona activa en Sirius Nomina Core.",
      status: 400,
    };
  }

  return { responsable: persona.nombre, idPersonalCore: persona.idEmpleado };
}

export function esErrorAutoria(
  valor: Autoria | ErrorAutoria,
): valor is ErrorAutoria {
  return "error" in valor;
}
