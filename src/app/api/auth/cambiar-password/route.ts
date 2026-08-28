import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { findPersonaByCedula, savePasswordHash } from "@/lib/airtable";
import { excedeIntentos, ipDe, olvidarIntentos } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { validatePassword } from "@/lib/validation";

export const runtime = "nodejs";

/** Mismo costo que los hashes que ya existen en Airtable ($2b$12$...). */
const BCRYPT_ROUNDS = 12;

/**
 * Cambia la contraseña de quien ya inició sesión.
 *
 * Existe aparte de `set-password` porque aquel solo sirve para estrenar una
 * cuenta y se niega a sobrescribir: aquí la identidad se vuelve a comprobar
 * con la contraseña actual. Tener la cookie no basta — si alguien deja la
 * sesión abierta, no debería poder quedarse con la cuenta.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    actual?: unknown;
    nueva?: unknown;
    confirmacion?: unknown;
  } | null;

  const actual = typeof body?.actual === "string" ? body.actual : "";
  if (!actual) {
    return NextResponse.json(
      { error: "Escribe tu contraseña actual." },
      { status: 400 },
    );
  }

  const problema = validatePassword(body?.nueva);
  if (problema) {
    return NextResponse.json({ error: problema }, { status: 400 });
  }

  if (body?.nueva !== body?.confirmacion) {
    return NextResponse.json(
      { error: "La confirmación no coincide con la contraseña nueva." },
      { status: 400 },
    );
  }

  if (actual === body?.nueva) {
    return NextResponse.json(
      { error: "La contraseña nueva debe ser distinta de la actual." },
      { status: 400 },
    );
  }

  // Se limita igual que el login: este endpoint también acepta intentos.
  if (await excedeIntentos("cambiar-password", session.cedula, ipDe(request))) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 },
    );
  }

  try {
    const persona = await findPersonaByCedula(session.cedula);

    if (!persona || !persona.activo || !persona.passwordHash) {
      return NextResponse.json(
        { error: "No pudimos verificar tu cuenta." },
        { status: 404 },
      );
    }

    const coincide = await bcrypt.compare(actual, persona.passwordHash);
    if (!coincide) {
      return NextResponse.json(
        { error: "La contraseña actual no es correcta." },
        { status: 403 },
      );
    }

    const hash = await bcrypt.hash(body!.nueva as string, BCRYPT_ROUNDS);
    await savePasswordHash(persona.recordId, hash);

    // El cambio salió bien: el contador de intentos vuelve a cero.
    await olvidarIntentos("cambiar-password", session.cedula);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("cambiar-password", error);
    return NextResponse.json(
      { error: "No pudimos guardar la contraseña. Intenta de nuevo." },
      { status: 502 },
    );
  }
}
