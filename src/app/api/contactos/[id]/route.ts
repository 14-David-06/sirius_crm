import { NextResponse } from "next/server";

import { actualizarDatosContacto, cambiarEstadoContacto } from "@/lib/clientes";
import { permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Corrige correo y teléfono, o activa/inactiva el contacto. */
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
      { error: "Tu nivel de acceso no permite modificar los contactos." },
      { status: 403 },
    );
  }

  const { id } = await params;
  if (!RECORD_ID.test(id)) {
    return NextResponse.json({ error: "Contacto inválido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    accion?: unknown;
    email?: unknown;
    telefono?: unknown;
    activo?: unknown;
  } | null;

  try {
    if (body?.accion === "datos") {
      const email = cadena(body.email);
      const telefono = cadena(body.telefono);

      if (email && !EMAIL.test(email)) {
        return NextResponse.json(
          { error: "El correo no tiene un formato válido." },
          { status: 400 },
        );
      }

      return NextResponse.json({
        contacto: await actualizarDatosContacto(
          id,
          { email, telefono },
          session.idEmpleado,
        ),
      });
    }

    if (body?.accion === "estado") {
      if (typeof body.activo !== "boolean") {
        return NextResponse.json(
          { error: "Indica si el contacto queda activo." },
          { status: 400 },
        );
      }

      return NextResponse.json({
        contacto: await cambiarEstadoContacto(id, body.activo, session.idEmpleado),
      });
    }

    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  } catch (error) {
    console.error("actualizar contacto", error);
    return NextResponse.json(
      { error: "No pudimos actualizar el contacto." },
      { status: 502 },
    );
  }
}

function cadena(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}
