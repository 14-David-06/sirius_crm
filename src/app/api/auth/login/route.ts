import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { findPersonaByCedula } from "@/lib/airtable";
import { excedeIntentos, ipDe, olvidarIntentos } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { normalizeCedula } from "@/lib/validation";

export const runtime = "nodejs";

/** Paso 2: valida la contraseña contra el hash bcrypt guardado en Airtable. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    cedula?: unknown;
    password?: unknown;
  } | null;

  const cedula = normalizeCedula(body?.cedula ?? null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!cedula || !password) {
    return NextResponse.json(
      { error: "Ingresa tu cédula y contraseña." },
      { status: 400 },
    );
  }

  if (await excedeIntentos("login", cedula, ipDe(request))) {
    return NextResponse.json(
      { error: "Demasiados intentos fallidos. Espera unos minutos." },
      { status: 429 },
    );
  }

  try {
    const persona = await findPersonaByCedula(cedula);

    if (!persona || !persona.activo) {
      return NextResponse.json(
        { error: "Cédula o contraseña incorrecta." },
        { status: 401 },
      );
    }

    if (!persona.passwordHash) {
      return NextResponse.json(
        { error: "Aún no tienes contraseña.", necesitaPassword: true },
        { status: 409 },
      );
    }

    const valida = await bcrypt.compare(password, persona.passwordHash);
    if (!valida) {
      return NextResponse.json(
        { error: "Cédula o contraseña incorrecta." },
        { status: 401 },
      );
    }

    await createSession({
      sub: persona.recordId,
      cedula: persona.cedula,
      nombre: persona.nombre,
      idEmpleado: persona.idEmpleado,
      rol: persona.rol,
      nivelAcceso: persona.nivelAcceso,
    });
    await olvidarIntentos("login", cedula);

    return NextResponse.json({ ok: true, nombre: persona.nombre });
  } catch (error) {
    console.error("login", error);
    return NextResponse.json(
      { error: "No pudimos iniciar sesión. Intenta de nuevo." },
      { status: 502 },
    );
  }
}
