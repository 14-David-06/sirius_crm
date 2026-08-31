import { NextResponse } from "next/server";

import { actualizarContacto, cambiarEstadoContacto } from "@/lib/clientes";
import { leerFunciones } from "@/lib/clientes-comun";
import { permisosDe } from "@/lib/permisos";
import { ETIQUETAS, invalidar } from "@/lib/cache";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Corrige la ficha del contacto, o lo activa/inactiva. */
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

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  try {
    if (body?.accion === "datos") {
      const nombre = cadena(body.nombre);
      const email = cadena(body.email);
      const emailNotificacion = cadena(body.emailNotificacion);
      const funciones = leerFunciones(body.funciones);

      if (!nombre) {
        return NextResponse.json(
          { error: "Escribe el nombre completo del contacto." },
          { status: 400 },
        );
      }
      // Airtable rechaza el registro completo si el campo email no es válido.
      if (email && !EMAIL.test(email)) {
        return NextResponse.json(
          { error: "El correo no tiene un formato válido." },
          { status: 400 },
        );
      }
      if (emailNotificacion && !EMAIL.test(emailNotificacion)) {
        return NextResponse.json(
          { error: "El correo de notificación no tiene un formato válido." },
          { status: 400 },
        );
      }
      if (funciones === "invalido") {
        return NextResponse.json(
          { error: "Alguna de las funciones no es una de las definidas." },
          { status: 400 },
        );
      }

      const actualizado = await actualizarContacto(
        id,
        {
          nombre,
          cargo: cadena(body.cargo),
          funciones,
          cedula: cadena(body.cedula),
          email,
          emailNotificacion,
          telefono: cadena(body.telefono),
        },
        session.idEmpleado,
      );
      invalidar(ETIQUETAS.contactos);
      return NextResponse.json({ contacto: actualizado });
    }

    if (body?.accion === "estado") {
      if (typeof body.activo !== "boolean") {
        return NextResponse.json(
          { error: "Indica si el contacto queda activo." },
          { status: 400 },
        );
      }

      const cambiado = await cambiarEstadoContacto(
        id,
        body.activo,
        session.idEmpleado,
      );
      invalidar(ETIQUETAS.contactos);
      return NextResponse.json({ contacto: cambiado });
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
