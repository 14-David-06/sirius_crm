import { NextResponse } from "next/server";

import { findPersonaByCedula } from "@/lib/airtable";
import { tooManyAttempts } from "@/lib/rate-limit";
import { normalizeCedula } from "@/lib/validation";

export const runtime = "nodejs";

/** Paso 1: valida que la cédula exista y dice si ya tiene contraseña. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const cedula = normalizeCedula(
    (body as { cedula?: unknown } | null)?.cedula ?? null,
  );

  if (!cedula) {
    return NextResponse.json({ error: "Cédula inválida." }, { status: 400 });
  }

  if (tooManyAttempts(`lookup:${cedula}`)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 },
    );
  }

  try {
    const persona = await findPersonaByCedula(cedula);

    if (!persona) {
      return NextResponse.json(
        { error: "No encontramos esa cédula en el sistema." },
        { status: 404 },
      );
    }

    if (!persona.activo) {
      return NextResponse.json(
        { error: "Este usuario no está activo. Contacta a Gestión del Ser." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      nombre: persona.nombre,
      necesitaPassword: persona.passwordHash === null,
    });
  } catch (error) {
    console.error("lookup", error);
    return NextResponse.json(
      { error: "No pudimos validar la cédula. Intenta de nuevo." },
      { status: 502 },
    );
  }
}
