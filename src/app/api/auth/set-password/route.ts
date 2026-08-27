import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { findPersonaByCedula, savePasswordHash } from "@/lib/airtable";
import { excedeIntentos, ipDe } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { normalizeCedula, validatePassword } from "@/lib/validation";

export const runtime = "nodejs";

/** Mismo costo que los hashes que ya existen en Airtable ($2b$12$...). */
const BCRYPT_ROUNDS = 12;

/** Crea la contraseña de una persona que todavía no tiene una. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    cedula?: unknown;
    password?: unknown;
    confirmacion?: unknown;
  } | null;

  const cedula = normalizeCedula(body?.cedula ?? null);
  if (!cedula) {
    return NextResponse.json({ error: "Cédula inválida." }, { status: 400 });
  }

  const problema = validatePassword(body?.password);
  if (problema) {
    return NextResponse.json({ error: problema }, { status: 400 });
  }

  if (body?.password !== body?.confirmacion) {
    return NextResponse.json(
      { error: "Las contraseñas no coinciden." },
      { status: 400 },
    );
  }

  if (await excedeIntentos("set-password", cedula, ipDe(request))) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 },
    );
  }

  try {
    const persona = await findPersonaByCedula(cedula);

    if (!persona || !persona.activo) {
      return NextResponse.json(
        { error: "No encontramos esa cédula en el sistema." },
        { status: 404 },
      );
    }

    // Si ya tiene contraseña, este endpoint no puede sobrescribirla:
    // eso sería un cambio de contraseña sin verificar identidad.
    if (persona.passwordHash) {
      return NextResponse.json(
        { error: "Este usuario ya tiene contraseña. Inicia sesión." },
        { status: 409 },
      );
    }

    const hash = await bcrypt.hash(body!.password as string, BCRYPT_ROUNDS);
    await savePasswordHash(persona.recordId, hash);

    await createSession({
      sub: persona.recordId,
      cedula: persona.cedula,
      nombre: persona.nombre,
      idEmpleado: persona.idEmpleado,
      rol: persona.rol,
      nivelAcceso: persona.nivelAcceso,
    });

    return NextResponse.json({ ok: true, nombre: persona.nombre });
  } catch (error) {
    console.error("set-password", error);
    return NextResponse.json(
      { error: "No pudimos guardar la contraseña. Intenta de nuevo." },
      { status: 502 },
    );
  }
}
