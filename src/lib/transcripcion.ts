/**
 * Transcripción de voz a texto con Whisper.
 *
 * Funciona con cualquier API compatible con el endpoint de OpenAI
 * (`/audio/transcriptions`): OpenAI, Groq (whisper-large-v3) o un
 * Whisper self-hosted. Solo cambia WHISPER_API_URL y WHISPER_MODEL.
 */

const URL_POR_DEFECTO = "https://api.openai.com/v1/audio/transcriptions";
const MODELO_POR_DEFECTO = "whisper-1";

/** 20 MB: más o menos 20 minutos de audio opus a 128 kbps. */
export const TAMANO_MAXIMO_AUDIO = 20 * 1024 * 1024;

export function transcripcionConfigurada(): boolean {
  return Boolean(process.env.WHISPER_API_KEY?.trim());
}

export async function transcribir(
  audio: Blob,
  nombreArchivo: string,
  vocabulario: string[] = [],
): Promise<string> {
  const apiKey = process.env.WHISPER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("WHISPER_API_KEY no está configurada");
  }

  const formData = new FormData();
  formData.append("file", audio, nombreArchivo);
  formData.append("model", process.env.WHISPER_MODEL?.trim() || MODELO_POR_DEFECTO);
  formData.append("language", "es");
  formData.append("response_format", "json");

  // El prompt le da contexto a Whisper: así acierta con los nombres de
  // producto y la jerga agronómica en vez de inventar palabras parecidas.
  if (vocabulario.length > 0) {
    formData.append(
      "prompt",
      `Visita comercial de Sirius Regenerative. Términos: ${vocabulario.join(", ")}.`,
    );
  }

  const respuesta = await fetch(
    process.env.WHISPER_API_URL?.trim() || URL_POR_DEFECTO,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    },
  );

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`Whisper ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }

  const data = (await respuesta.json()) as { text?: string };
  return (data.text ?? "").trim();
}
