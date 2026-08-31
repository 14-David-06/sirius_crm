import { NextResponse } from "next/server";

import { crearContacto, listarContactos } from "@/lib/clientes";
import { leerFunciones } from "@/lib/clientes-comun";
import { permisosDe } from "@/lib/permisos";
import { ETIQUETAS, invalidar } from "@/lib/cache";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!permisosDe(session).verTodo) {
    return NextResponse.json(
      { error: "Tu nivel de acceso no permite consultar los contactos." },
      { status: 403 },
    );
  }

  try {
    return NextResponse.json({ contactos: await listarContactos() });
  } catch (error) {
    console.error("listar contactos", error);
    return NextResponse.json(
      { error: "No pudimos leer los contactos." },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
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

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const nombre = cadena(body.nombre);
  const cliente = cadena(body.cliente);
  const email = cadena(body.email);
  const emailNotificacion = cadena(body.emailNotificacion);
  const funciones = leerFunciones(body.funciones);

  if (!nombre) {
    return NextResponse.json(
      { error: "Escribe el nombre completo del contacto." },
      { status: 400 },
    );
  }
  if (!cliente || !RECORD_ID.test(cliente)) {
    return NextResponse.json(
      { error: "Elige el cliente al que pertenece." },
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

  try {
    const contacto = await crearContacto({
      nombre,
      cliente,
      autorId: session.idEmpleado,
      cargo: cadena(body.cargo) ?? undefined,
      funciones,
      cedula: cadena(body.cedula) ?? undefined,
      email: email ?? undefined,
      emailNotificacion: emailNotificacion ?? undefined,
      telefono: cadena(body.telefono) ?? undefined,
    });

    invalidar(ETIQUETAS.contactos);
    return NextResponse.json({ contacto }, { status: 201 });
  } catch (error) {
    console.error("crear contacto", error);
    return NextResponse.json(
      { error: "No pudimos guardar el contacto en Airtable." },
      { status: 502 },
    );
  }
}

function cadena(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}
