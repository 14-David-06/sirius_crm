import { NextResponse } from "next/server";

import { listarPersonalActivo } from "@/lib/airtable";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * El personal activo, para elegir a quién se le asigna algo (el encargado de
 * una tarea de proyecto, por ejemplo). Es lo mismo que el dashboard ya ofrece
 * en sus selectores.
 *
 * Solo nombre e ID de empleado: teléfono y correo existen en `PersonaActiva`
 * para el pie de la cotización, pero quien asigna una tarea no los necesita.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const personal = await listarPersonalActivo();
    return NextResponse.json({
      personal: personal.map((persona) => ({
        nombre: persona.nombre,
        idEmpleado: persona.idEmpleado,
        rol: persona.rol,
      })),
    });
  } catch (error) {
    console.error("listar personal", error);
    return NextResponse.json(
      { error: "No pudimos leer el personal." },
      { status: 502 },
    );
  }
}
