import { NextResponse } from "next/server";

import { ETIQUETAS, invalidar } from "@/lib/cache";
import {
  actualizarCliente,
  cambiarEstadoCliente,
  esErrorDatosCliente,
  leerDatosCliente,
  nombreClienteRepetido,
} from "@/lib/clientes";
import { permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

/**
 * Corrige la ficha del cliente, o lo activa/inactiva.
 *
 * El maestro de clientes es dato compartido: lo edita quien administra el
 * catálogo, igual que contactos y productos. Nunca se borra un cliente —
 * visitas, casos y pedidos lo referencian por serial.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!permisosDe(session).gestionarCatalogo) {
    return NextResponse.json(
      { error: "Tu nivel de acceso no permite modificar los clientes." },
      { status: 403 },
    );
  }

  const { id } = await params;
  if (!RECORD_ID.test(id)) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  try {
    if (body?.accion === "datos") {
      const datos = leerDatosCliente(body);
      if (esErrorDatosCliente(datos)) {
        return NextResponse.json(
          { error: datos.error },
          { status: datos.status },
        );
      }

      const repetido = await nombreClienteRepetido(datos.nombre, id);
      if (repetido) {
        return NextResponse.json(
          {
            error: `Ya existe otro cliente llamado «${datos.nombre}» (${repetido}).`,
          },
          { status: 409 },
        );
      }

      const actualizado = await actualizarCliente(
        id,
        datos,
        session.idEmpleado,
      );

      invalidar(ETIQUETAS.clientes);
      return NextResponse.json({ cliente: actualizado });
    }

    if (body?.accion === "estado") {
      if (typeof body.activo !== "boolean") {
        return NextResponse.json(
          { error: "Indica si el cliente queda activo." },
          { status: 400 },
        );
      }

      const cambiado = await cambiarEstadoCliente(
        id,
        body.activo,
        session.idEmpleado,
      );
      invalidar(ETIQUETAS.clientes);
      return NextResponse.json({ cliente: cambiado });
    }

    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  } catch (error) {
    console.error("actualizar cliente", error);
    return NextResponse.json(
      { error: "No pudimos actualizar el cliente en Airtable." },
      { status: 502 },
    );
  }
}
