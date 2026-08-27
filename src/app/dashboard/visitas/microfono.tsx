"use client";

import { useEffect, useRef, useState } from "react";

type Estado = "listo" | "grabando" | "procesando";

/** Icono de micrófono, incluido aquí porque solo lo usa el dictado. */
function IconMic({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function IconStop({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

export function Microfono({
  onTexto,
  vocabulario = [],
  disponible,
  etiqueta = "Dictar",
  variante = "compacto",
}: {
  onTexto: (texto: string) => void;
  vocabulario?: string[];
  disponible: boolean;
  etiqueta?: string;
  variante?: "compacto" | "amplio";
}) {
  const [estado, setEstado] = useState<Estado>("listo");
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const grabadoraRef = useRef<MediaRecorder | null>(null);
  const trozosRef = useRef<Blob[]>([]);
  const cancelarRef = useRef(false);

  useEffect(() => {
    if (estado !== "grabando") return;
    const intervalo = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(intervalo);
  }, [estado]);

  // Si el componente se desmonta grabando, se suelta el micrófono.
  useEffect(() => {
    return () => {
      grabadoraRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function iniciar() {
    setError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("Este navegador no permite grabar audio.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("No diste permiso para usar el micrófono.");
      return;
    }

    const tipo = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ].find((candidato) => MediaRecorder.isTypeSupported(candidato));

    const grabadora = new MediaRecorder(
      stream,
      tipo ? { mimeType: tipo } : undefined,
    );

    trozosRef.current = [];
    cancelarRef.current = false;

    grabadora.ondataavailable = (evento) => {
      if (evento.data.size > 0) trozosRef.current.push(evento.data);
    };

    grabadora.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());

      if (cancelarRef.current) {
        setEstado("listo");
        setSegundos(0);
        return;
      }

      const audio = new Blob(trozosRef.current, {
        type: grabadora.mimeType || "audio/webm",
      });
      setSegundos(0);

      if (audio.size < 1200) {
        setEstado("listo");
        setError("La grabación fue muy corta.");
        return;
      }

      setEstado("procesando");
      await enviar(audio, grabadora.mimeType);
      setEstado("listo");
    };

    grabadora.start();
    grabadoraRef.current = grabadora;
    setEstado("grabando");
  }

  async function enviar(audio: Blob, mimeType: string) {
    const extension = mimeType.includes("mp4") ? "mp4" : "webm";
    const formData = new FormData();
    formData.append("audio", audio, `visita.${extension}`);
    if (vocabulario.length > 0) {
      formData.append("vocabulario", vocabulario.join(","));
    }

    try {
      const respuesta = await fetch("/api/transcribir", {
        method: "POST",
        body: formData,
      });
      const data = (await respuesta.json().catch(() => ({}))) as {
        texto?: string;
        error?: string;
      };

      if (!respuesta.ok || !data.texto) {
        setError(data.error ?? "No pudimos transcribir el audio.");
        return;
      }

      onTexto(data.texto);
    } catch {
      setError("Se cayó la conexión mientras transcribíamos.");
    }
  }

  function detener(cancelar = false) {
    cancelarRef.current = cancelar;
    grabadoraRef.current?.stop();
  }

  if (!disponible) {
    return (
      <span
        title="Falta configurar WHISPER_API_KEY en .env.local"
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 dark:border-white/15 dark:text-slate-400"
      >
        <IconMic className="h-3.5 w-3.5" />
        Dictado no configurado
      </span>
    );
  }

  const amplio = variante === "amplio";

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {estado === "grabando" ? (
        <>
          <button
            type="button"
            onClick={() => detener(false)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-600 font-medium text-white transition-colors duration-200 hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:outline-none ${
              amplio ? "px-4 py-2 text-sm" : "px-2.5 py-1 text-xs"
            }`}
          >
            <IconStop className={amplio ? "h-4 w-4" : "h-3.5 w-3.5"} />
            Detener · {formatearTiempo(segundos)}
            <span className="sr-only">y transcribir</span>
          </button>
          <button
            type="button"
            onClick={() => detener(true)}
            className="cursor-pointer text-xs text-slate-600 underline transition-colors duration-200 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Descartar
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={iniciar}
          disabled={estado === "procesando"}
          aria-label={`${etiqueta} con el micrófono`}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-60 ${
            amplio
              ? "border-blue-700 px-4 py-2 text-sm text-blue-800 hover:bg-blue-50 dark:border-blue-400/50 dark:text-blue-300 dark:hover:bg-blue-500/10"
              : "border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          }`}
        >
          <IconMic className={amplio ? "h-4 w-4" : "h-3.5 w-3.5"} />
          {estado === "procesando" ? "Transcribiendo…" : etiqueta}
        </button>
      )}

      {error ? (
        <span role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function formatearTiempo(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  return `${minutos}:${String(segundos % 60).padStart(2, "0")}`;
}
