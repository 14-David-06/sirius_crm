"use client";

import { useState } from "react";

export type Solicitud = {
  client_id: string;
  redirect_uri: string;
  code_challenge?: string;
  code_challenge_method?: string;
  response_type?: string;
  state?: string;
  scope?: string;
  resource?: string;
};

const inputClass =
  "rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-black/35 focus:border-blue-600 disabled:opacity-60 dark:border-white/20 dark:placeholder:text-white/35 dark:focus:border-blue-400";

export function FormularioAutorizar({
  solicitud,
  nombreCliente,
  destino,
  ofrecerEscritura,
}: {
  solicitud: Solicitud;
  nombreCliente: string;
  destino: string;
  ofrecerEscritura: boolean;
}) {
  const [cedula, setCedula] = useState("");
  const [password, setPassword] = useState("");
  const [escribir, setEscribir] = useState(ofrecerEscritura);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function autorizar(event: React.FormEvent) {
    event.preventDefault();

    if (cedula.length < 5 || !password) {
      setError("Ingresa tu cédula y contraseña.");
      return;
    }

    setCargando(true);
    setError(null);

    const respuesta = await fetch("/api/oauth/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...solicitud, cedula, password, escribir }),
    });

    const datos = (await respuesta.json().catch(() => ({}))) as {
      redirect?: string;
      error?: string;
    };

    if (!respuesta.ok || !datos.redirect) {
      setCargando(false);
      setError(datos.error ?? "No pudimos autorizar la conexión.");
      return;
    }

    // El código de autorización vuelve al cliente por su propio redirect_uri;
    // se deja `cargando` puesto porque la navegación ya está en camino.
    window.location.href = datos.redirect;
  }

  return (
    <>
      <form onSubmit={autorizar} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cedula" className="text-sm font-medium">
            Cédula
          </label>
          <input
            id="cedula"
            name="cedula"
            type="text"
            inputMode="numeric"
            autoComplete="username"
            autoFocus
            maxLength={15}
            placeholder="1234567890"
            value={cedula}
            onChange={(event) =>
              setCedula(event.target.value.replace(/\D/g, ""))
            }
            disabled={cargando}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={cargando}
            className={inputClass}
          />
        </div>

        <div className="mt-2 rounded-lg border border-black/10 p-4 text-sm dark:border-white/15">
          <p className="font-medium">Qué podrá hacer</p>

          <ul className="mt-2 flex flex-col gap-1.5 text-black/70 dark:text-white/70">
            <li>
              Consultar clientes, contactos, visitas, casos, pedidos y catálogo.
            </li>
            {escribir ? (
              <li>
                Registrar visitas, abrir casos, crear pedidos y mover estados.
              </li>
            ) : null}
          </ul>

          {ofrecerEscritura ? (
            <label className="mt-3 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={escribir}
                onChange={(event) => setEscribir(event.target.checked)}
                disabled={cargando}
                className="mt-0.5"
              />
              <span className="text-black/70 dark:text-white/70">
                Permitir que registre y modifique, no solo que consulte.
              </span>
            </label>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={cargando}
          className="bg-foreground text-background mt-2 rounded-full px-6 py-3 text-sm font-medium transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {cargando ? "Un momento…" : `Autorizar ${nombreCliente}`}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-black/50 dark:text-white/50">
        Al autorizar, el código se envía a {destino}. Para cortar el acceso,
        quita el conector en Claude; si necesitas cortarlo sin tocar Claude,
        pídele a un Super Admin que inactive tu usuario en Sirius Nomina Core —
        cambiar la contraseña no basta.
      </p>
    </>
  );
}
