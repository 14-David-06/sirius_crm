import { NextResponse } from "next/server";

import { permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";
import {
  TAMANO_MAXIMO_AUDIO,
  transcribir,
  transcripcionConfigurada,
} from "@/lib/transcripcion";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // El dictado solo sirve para registrar visitas: mismo permiso que crearlas.
  if (!permisosDe(session).crear) {
    return NextResponse.json(
      { error: "Tu nivel de acceso no permite registrar visitas." },
      { status: 403 },
    );
  }

  if (!transcripcionConfigurada()) {
    return NextResponse.json(
      {
        error:
          "La transcripción no está configurada. Falta WHISPER_API_KEY en .env.local.",
      },
      { status: 503 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const audio = formData?.get("audio");

  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "No llegó audio." }, { status: 400 });
  }

  if (audio.size > TAMANO_MAXIMO_AUDIO) {
    return NextResponse.json(
      { error: "El audio es demasiado largo. Graba en tramos más cortos." },
      { status: 413 },
    );
  }

  const vocabulario = String(formData?.get("vocabulario") ?? "")
    .split(",")
    .map((termino) => termino.trim())
    .filter(Boolean)
    .slice(0, 60);

  try {
    const nombre =
      audio instanceof File && audio.name ? audio.name : "audio.webm";
    const texto = await transcribir(audio, nombre, vocabulario);

    if (!texto) {
      return NextResponse.json(
        { error: "No se entendió el audio. Intenta de nuevo." },
        { status: 422 },
      );
    }

    return NextResponse.json({ texto });
  } catch (error) {
    console.error("transcribir", error);
    return NextResponse.json(
      { error: "No pudimos transcribir el audio." },
      { status: 502 },
    );
  }
}
