"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Paso = "cedula" | "password" | "crear-password";

const inputClass =
  "rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-black/35 focus:border-blue-600 disabled:opacity-60 dark:border-white/20 dark:placeholder:text-white/35 dark:focus:border-blue-400";

export default function LoginPage() {
  const router = useRouter();

  const [paso, setPaso] = useState<Paso>("cedula");
  const [cedula, setCedula] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function post(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    return { ok: response.ok, data };
  }

  async function enviarCedula(event: React.FormEvent) {
    event.preventDefault();
    if (cedula.length < 5) {
      setError("La cédula debe tener al menos 5 dígitos.");
      return;
    }

    setCargando(true);
    setError(null);
    const { ok, data } = await post("/api/auth/lookup", { cedula });
    setCargando(false);

    if (!ok) {
      setError(String(data.error ?? "No pudimos validar la cédula."));
      return;
    }

    setNombre(String(data.nombre ?? ""));
    setPaso(data.necesitaPassword ? "crear-password" : "password");
  }

  async function enviarPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!password) {
      setError("Ingresa tu contraseña.");
      return;
    }

    setCargando(true);
    setError(null);
    const { ok, data } = await post("/api/auth/login", { cedula, password });
    setCargando(false);

    if (!ok) {
      if (data.necesitaPassword) {
        setPassword("");
        setPaso("crear-password");
      }
      setError(String(data.error ?? "No pudimos iniciar sesión."));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function crearPassword(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setCargando(true);
    setError(null);
    const { ok, data } = await post("/api/auth/set-password", {
      cedula,
      password,
      confirmacion,
    });
    setCargando(false);

    if (!ok) {
      setError(String(data.error ?? "No pudimos guardar la contraseña."));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function volver() {
    setPaso("cedula");
    setPassword("");
    setConfirmacion("");
    setNombre("");
    setError(null);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <nav className="mx-auto flex max-w-5xl items-center px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Sirius <span className="text-blue-600 dark:text-blue-400">CRM</span>
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          {paso === "cedula" ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight">
                Iniciar sesión
              </h1>
              <p className="mt-2 text-sm text-black/60 dark:text-white/60">
                Ingresa tu número de cédula para continuar.
              </p>

              <form onSubmit={enviarCedula} className="mt-8 flex flex-col gap-4">
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

                <MensajeError mensaje={error} />
                <BotonEnviar cargando={cargando} texto="Continuar" />
              </form>
            </>
          ) : null}

          {paso === "password" ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight">
                Hola, {primerNombre(nombre)}
              </h1>
              <p className="mt-2 text-sm text-black/60 dark:text-white/60">
                Ingresa tu contraseña para entrar.
              </p>

              <form
                onSubmit={enviarPassword}
                className="mt-8 flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="password" className="text-sm font-medium">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={cargando}
                    className={inputClass}
                  />
                </div>

                <MensajeError mensaje={error} />
                <BotonEnviar cargando={cargando} texto="Entrar" />
              </form>

              <BotonVolver onClick={volver} />
            </>
          ) : null}

          {paso === "crear-password" ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight">
                Crea tu contraseña
              </h1>
              <p className="mt-2 text-sm text-black/60 dark:text-white/60">
                {primerNombre(nombre)}, aún no tienes una contraseña. Define una
                para acceder al CRM.
              </p>

              <form
                onSubmit={crearPassword}
                className="mt-8 flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="nueva" className="text-sm font-medium">
                    Nueva contraseña
                  </label>
                  <input
                    id="nueva"
                    name="nueva"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={cargando}
                    className={inputClass}
                  />
                  <p className="text-xs text-black/50 dark:text-white/50">
                    Al menos 8 caracteres, con una letra y un número.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirmacion" className="text-sm font-medium">
                    Confirmar contraseña
                  </label>
                  <input
                    id="confirmacion"
                    name="confirmacion"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repite la contraseña"
                    value={confirmacion}
                    onChange={(event) => setConfirmacion(event.target.value)}
                    disabled={cargando}
                    className={inputClass}
                  />
                </div>

                <MensajeError mensaje={error} />
                <BotonEnviar cargando={cargando} texto="Guardar y entrar" />
              </form>

              <BotonVolver onClick={volver} />
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? "";
}

function MensajeError({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {mensaje}
    </p>
  );
}

function BotonEnviar({
  cargando,
  texto,
}: {
  cargando: boolean;
  texto: string;
}) {
  return (
    <button
      type="submit"
      disabled={cargando}
      className="mt-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-50"
    >
      {cargando ? "Un momento…" : texto}
    </button>
  );
}

function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:text-foreground mt-6 w-full text-center text-sm text-black/60 underline dark:text-white/60"
    >
      Usar otra cédula
    </button>
  );
}
