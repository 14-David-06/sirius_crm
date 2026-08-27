"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { IconClose } from "../icons";
import type { ClienteSelector } from "./modulo";

const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";
const etiqueta = "text-xs font-medium text-slate-700 dark:text-slate-300";

type Formulario = {
  nombre: string;
  cliente: string;
  cargo: string;
  cedula: string;
  telefono: string;
  email: string;
  emailNotificacion: string;
};

const VACIO: Formulario = {
  nombre: "",
  cliente: "",
  cargo: "",
  cedula: "",
  telefono: "",
  email: "",
  emailNotificacion: "",
};

export function FormularioContacto({
  clientes,
  cargos,
  onCerrar,
}: {
  clientes: ClienteSelector[];
  /** Los cargos ya usados por el equipo: el campo es texto libre en Airtable. */
  cargos: string[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const dialogoRef = useRef<HTMLDivElement>(null);

  const [datos, setDatos] = useState<Formulario>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function actualizar(cambios: Partial<Formulario>) {
    setDatos((previos) => ({ ...previos, ...cambios }));
  }

  /* Atajos: Esc cierra, Ctrl+Enter guarda */
  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        onCerrar();
      }
      if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
        dialogoRef.current?.querySelector("form")?.requestSubmit();
      }
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();

    if (!datos.nombre.trim()) {
      setError("Escribe el nombre completo del contacto.");
      return;
    }
    if (!datos.cliente) {
      setError("Elige el cliente al que pertenece.");
      return;
    }

    setGuardando(true);
    setError(null);

    const respuesta = await fetch("/api/contactos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });

    setGuardando(false);

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos guardar el contacto."));
      return;
    }

    router.refresh();
    onCerrar();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6">
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-contacto"
        className="my-4 w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2
              id="titulo-contacto"
              className="text-base font-semibold tracking-tight"
            >
              Nuevo contacto
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Se guarda en la base Sirius Clients Core · tabla Personal Cliente
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="cursor-pointer rounded-lg p-2 text-slate-600 transition-colors duration-200 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={guardar} className="px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contacto-nombre" className={etiqueta}>
                Nombre completo
              </label>
              <input
                id="contacto-nombre"
                required
                value={datos.nombre}
                onChange={(e) => actualizar({ nombre: e.target.value })}
                placeholder="María Alexandra Montoya"
                className={`${input} mt-1`}
              />
            </div>

            <div>
              <label htmlFor="contacto-cliente" className={etiqueta}>
                Cliente
              </label>
              <select
                id="contacto-cliente"
                required
                value={datos.cliente}
                onChange={(e) => actualizar({ cliente: e.target.value })}
                className={`${input} mt-1 cursor-pointer`}
              >
                <option value="">Elige un cliente…</option>
                {clientes.map((c) => (
                  <option key={c.recordId} value={c.recordId}>
                    {c.nombre}
                    {c.ciudad ? ` — ${c.ciudad}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="contacto-cargo" className={etiqueta}>
                Cargo{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <input
                id="contacto-cargo"
                list="cargos-existentes"
                value={datos.cargo}
                onChange={(e) => actualizar({ cargo: e.target.value })}
                placeholder="Jefe de Sanidad"
                className={`${input} mt-1`}
              />
              {/* Texto libre en Airtable: se sugieren los cargos ya usados
                  para no multiplicar variantes del mismo cargo. */}
              <datalist id="cargos-existentes">
                {cargos.map((cargo) => (
                  <option key={cargo} value={cargo} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="contacto-cedula" className={etiqueta}>
                Cédula{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <input
                id="contacto-cedula"
                inputMode="numeric"
                value={datos.cedula}
                onChange={(e) => actualizar({ cedula: e.target.value })}
                className={`${input} mt-1`}
              />
            </div>

            <div>
              <label htmlFor="contacto-telefono" className={etiqueta}>
                Teléfono{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <input
                id="contacto-telefono"
                type="tel"
                value={datos.telefono}
                onChange={(e) => actualizar({ telefono: e.target.value })}
                placeholder="300 1234567"
                className={`${input} mt-1`}
              />
            </div>

            <div>
              <label htmlFor="contacto-email" className={etiqueta}>
                Correo{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <input
                id="contacto-email"
                type="email"
                value={datos.email}
                onChange={(e) => actualizar({ email: e.target.value })}
                placeholder="nombre@empresa.com"
                className={`${input} mt-1`}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="contacto-email-notif" className={etiqueta}>
                Correo de notificación{" "}
                <span className="font-normal text-slate-500">
                  (opcional, si es distinto al principal)
                </span>
              </label>
              <input
                id="contacto-email-notif"
                type="email"
                value={datos.emailNotificacion}
                onChange={(e) =>
                  actualizar({ emailNotificacion: e.target.value })
                }
                className={`${input} mt-1`}
              />
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/15 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
            <button
              type="button"
              onClick={onCerrar}
              className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              {guardando ? "Guardando…" : "Guardar contacto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
