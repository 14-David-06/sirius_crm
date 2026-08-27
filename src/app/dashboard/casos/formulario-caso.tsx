"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ESTADOS_CASO, TIPOS_CASO, type EstadoCaso, type TipoCaso } from "@/lib/casos";
import type { ClienteCore } from "@/lib/clientes";
import { formatearFecha } from "@/lib/fechas";
import { IconClose } from "../icons";
import type { VisitaOrigen } from "./modulo";

const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";
const etiqueta = "text-xs font-medium text-slate-700 dark:text-slate-300";

/** Solo se puede abrir un caso en un estado que siga exigiendo trabajo. */
const ESTADOS_INICIALES = ESTADOS_CASO.filter(
  (estado): estado is Extract<EstadoCaso, "Abierto" | "En proceso"> =>
    estado === "Abierto" || estado === "En proceso",
);

type Formulario = {
  clienteId: string;
  fechaApertura: string;
  tipo: TipoCaso;
  descripcion: string;
  responsableId: string;
  estado: "Abierto" | "En proceso";
  fechaLimite: string;
  observaciones: string;
  visitaOrigen: string;
};

function vacio(hoy: string, idEmpleado: string): Formulario {
  return {
    clienteId: "",
    fechaApertura: hoy,
    tipo: "Comercial",
    descripcion: "",
    responsableId: idEmpleado,
    estado: "Abierto",
    fechaLimite: "",
    observaciones: "",
    visitaOrigen: "",
  };
}

export function FormularioCaso({
  clientes,
  visitas,
  personal,
  sesion,
  hoy,
  onCerrar,
}: {
  clientes: ClienteCore[];
  visitas: VisitaOrigen[];
  personal: { nombre: string; rol: string | null; idEmpleado: string }[];
  sesion: { idEmpleado: string; nombre: string };
  hoy: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const dialogoRef = useRef<HTMLDivElement>(null);

  const { idEmpleado, nombre: usuario } = sesion;

  const [datos, setDatos] = useState<Formulario>(() => vacio(hoy, sesion.idEmpleado));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cliente = clientes.find((c) => c.recordId === datos.clienteId);

  // La visita de origen solo tiene sentido si es del mismo cliente.
  const visitasDelCliente = useMemo(() => {
    if (!cliente) return [];
    return visitas
      .filter(
        (visita) =>
          (cliente.id && visita.idClienteCore === cliente.id) ||
          visita.cliente === cliente.nombre,
      )
      .slice(0, 20);
  }, [visitas, cliente]);

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

    if (!cliente) {
      setError("Elige el cliente que abrió el requerimiento.");
      return;
    }
    if (!datos.descripcion.trim()) {
      setError("Describe el requerimiento del cliente.");
      return;
    }
    if (datos.fechaLimite && datos.fechaLimite < datos.fechaApertura) {
      setError("La fecha límite no puede ser anterior a la apertura.");
      return;
    }

    setGuardando(true);
    setError(null);

    const respuesta = await fetch("/api/casos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idClienteCore: cliente.id,
        cliente: cliente.nombre,
        fechaApertura: datos.fechaApertura,
        tipo: datos.tipo,
        descripcion: datos.descripcion,
        responsableId: datos.responsableId,
        estado: datos.estado,
        fechaLimite: datos.fechaLimite,
        observaciones: datos.observaciones,
        visitaOrigen: datos.visitaOrigen,
      }),
    });

    setGuardando(false);

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos guardar el caso."));
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
        aria-labelledby="titulo-caso"
        className="my-4 w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2
              id="titulo-caso"
              className="text-base font-semibold tracking-tight"
            >
              Abrir caso
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Se guarda en la base Sirius CRM · tabla Casos
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
            <div className="sm:col-span-2">
              <label htmlFor="caso-cliente" className={etiqueta}>
                Cliente
              </label>
              <select
                id="caso-cliente"
                required
                value={datos.clienteId}
                onChange={(e) =>
                  // La visita de origen era del cliente anterior: se descarta.
                  actualizar({ clienteId: e.target.value, visitaOrigen: "" })
                }
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
              <label htmlFor="caso-tipo" className={etiqueta}>
                Tipo de requerimiento
              </label>
              <select
                id="caso-tipo"
                value={datos.tipo}
                onChange={(e) =>
                  actualizar({ tipo: e.target.value as TipoCaso })
                }
                className={`${input} mt-1 cursor-pointer`}
              >
                {TIPOS_CASO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="caso-estado" className={etiqueta}>
                Estado inicial
              </label>
              <select
                id="caso-estado"
                value={datos.estado}
                onChange={(e) =>
                  actualizar({
                    estado: e.target.value as "Abierto" | "En proceso",
                  })
                }
                className={`${input} mt-1 cursor-pointer`}
              >
                {ESTADOS_INICIALES.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="caso-descripcion" className={etiqueta}>
                Descripción
              </label>
              <textarea
                id="caso-descripcion"
                required
                rows={3}
                value={datos.descripcion}
                onChange={(e) => actualizar({ descripcion: e.target.value })}
                placeholder="Reclamo por lote con germinación baja, piden visita técnica…"
                className={`${input} mt-1 resize-y`}
              />
            </div>

            <div>
              <label htmlFor="caso-responsable" className={etiqueta}>
                Responsable
              </label>
              {/* Se envía el ID de empleado, no el nombre. */}
              <select
                id="caso-responsable"
                value={datos.responsableId}
                onChange={(e) => actualizar({ responsableId: e.target.value })}
                className={`${input} mt-1 cursor-pointer`}
              >
                {/* La sesión puede no estar en el personal activo. */}
                {personal.some((p) => p.idEmpleado === idEmpleado) ? null : (
                  <option value="">{usuario} (tú)</option>
                )}
                {personal.map((p) => (
                  <option key={p.idEmpleado} value={p.idEmpleado}>
                    {p.nombre}
                    {p.idEmpleado === idEmpleado ? " (tú)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="caso-apertura" className={etiqueta}>
                Fecha de apertura
              </label>
              <input
                id="caso-apertura"
                type="date"
                required
                value={datos.fechaApertura}
                onChange={(e) => actualizar({ fechaApertura: e.target.value })}
                className={`${input} mt-1`}
              />
            </div>

            <div>
              <label htmlFor="caso-limite" className={etiqueta}>
                Fecha límite{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <input
                id="caso-limite"
                type="date"
                min={datos.fechaApertura}
                value={datos.fechaLimite}
                onChange={(e) => actualizar({ fechaLimite: e.target.value })}
                className={`${input} mt-1`}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                Sin plazo el caso no aparece en la agenda del inicio.
              </p>
            </div>

            <div>
              <label htmlFor="caso-visita" className={etiqueta}>
                Visita de origen{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <select
                id="caso-visita"
                value={datos.visitaOrigen}
                disabled={!cliente || visitasDelCliente.length === 0}
                onChange={(e) => actualizar({ visitaOrigen: e.target.value })}
                className={`${input} mt-1 cursor-pointer`}
              >
                <option value="">
                  {!cliente
                    ? "Elige primero el cliente"
                    : visitasDelCliente.length === 0
                      ? "Sin visitas registradas"
                      : "Ninguna"}
                </option>
                {visitasDelCliente.map((visita) => (
                  <option key={visita.recordId} value={visita.recordId}>
                    {formatearFecha(visita.fecha)}
                    {visita.objetivo ? ` — ${recortar(visita.objetivo)}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="caso-observaciones" className={etiqueta}>
                Observaciones{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <textarea
                id="caso-observaciones"
                rows={2}
                value={datos.observaciones}
                onChange={(e) => actualizar({ observaciones: e.target.value })}
                className={`${input} mt-1 resize-y`}
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
              {guardando ? "Guardando…" : "Abrir caso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function recortar(valor: string): string {
  return valor.length > 44 ? `${valor.slice(0, 44)}…` : valor;
}
