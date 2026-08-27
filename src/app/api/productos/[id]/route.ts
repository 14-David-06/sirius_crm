import { NextResponse } from "next/server";

import {
  actualizarPrecio,
  cambiarEstadoProducto,
  leerPrecio,
} from "@/lib/productos";
import { permisosDe } from "@/lib/permisos";
import { ETIQUETAS, invalidar } from "@/lib/cache";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

/** Ajusta el precio de lista o saca el producto del catálogo vigente. */
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
      { error: "Tu nivel de acceso no permite modificar el catálogo." },
      { status: 403 },
    );
  }

  const { id } = await params;
  if (!RECORD_ID.test(id)) {
    return NextResponse.json({ error: "Producto inválido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    accion?: unknown;
    precio?: unknown;
    activo?: unknown;
  } | null;

  try {
    if (body?.accion === "precio") {
      const precio = leerPrecio(body.precio);
      if (precio === "invalido") {
        return NextResponse.json(
          { error: "El precio debe ser un número igual o mayor que cero." },
          { status: 400 },
        );
      }

      const conPrecio = await actualizarPrecio(id, precio, session.idEmpleado);
      invalidar(ETIQUETAS.productos);
      return NextResponse.json({ producto: conPrecio });
    }

    if (body?.accion === "estado") {
      if (typeof body.activo !== "boolean") {
        return NextResponse.json(
          { error: "Indica si el producto queda activo." },
          { status: 400 },
        );
      }

      const cambiado = await cambiarEstadoProducto(
        id,
        body.activo,
        session.idEmpleado,
      );
      invalidar(ETIQUETAS.productos);
      return NextResponse.json({ producto: cambiado });
    }

    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  } catch (error) {
    console.error("actualizar producto", error);
    return NextResponse.json(
      { error: "No pudimos actualizar el producto." },
      { status: 502 },
    );
  }
}
