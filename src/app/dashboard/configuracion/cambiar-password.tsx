"use client";

import { useState } from "react";

const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";
const etiqueta = "text-xs font-medium text-slate-700 dark:text-slate-300";

export function CambiarPassword() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    setListo(false);

    const respuesta = await fetch("/api/auth/cambiar-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual, nueva, confirmacion }),
    });
    const data = (await respuesta.json().catch(() => ({}))) as {
      error?: string;
    };

    setGuardando(false);

    if (!respuesta.ok) {
      setError(data.error ?? "No pudimos cambiar la contraseña.");
      return;
    }

    // Nada de lo escrito se conserva en pantalla tras un cambio correcto.
    setActual("");
    setNueva("");
    setConfirmacion("");
    setListo(true);
  }

  return (
    <form onSubmit={enviar} className="mt-4 flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="clave-actual" className={etiqueta}>
          Contraseña actual
        </label>
        <input
          id="clave-actual"
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          disabled={guardando}
          className={input}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="clave-nueva" className={etiqueta}>
          Contraseña nueva
        </label>
        <input
          id="clave-nueva"
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          disabled={guardando}
          className={input}
        />
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Mínimo 8 caracteres, con al menos una letra y un número.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="clave-confirmacion" className={etiqueta}>
          Repite la contraseña nueva
        </label>
        <input
          id="clave-confirmacion"
          type="password"
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          disabled={guardando}
          className={input}
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {listo ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          Contraseña actualizada. La próxima vez que entres, usa la nueva.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={guardando}
        className="cursor-pointer self-start rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
      >
        {guardando ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
