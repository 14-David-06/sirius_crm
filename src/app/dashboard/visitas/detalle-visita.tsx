"use client";

import { useEffect, useRef } from "react";

import type { Visita } from "@/lib/crm";
import { formatearFecha } from "@/lib/fechas";
import { IconClose } from "../icons";
import type { ContactoVisita } from "./modulo";

const etiquetaDato =
  "text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500";

/**
 * La visita completa. El listado muestra ocho columnas recortadas; aquí está
 * todo lo que se registró, sin `line-clamp`, que es lo que uno necesita antes
 * de llamar al cliente.
 */
export function DetalleVisita({
  visita,
  contactos,
  puedeEditar,
  onEditar,
  onCerrar,
}: {
  visita: Visita;
  contactos: ContactoVisita[];
  puedeEditar: boolean;
  onEditar: () => void;
  onCerrar: () => void;
}) {
  const dialogoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  // La visita guarda el serial del contacto; el nombre vive en el directorio.
  const contacto = visita.idContactoCore
    ? contactos.find((c) => c.codigo === visita.idContactoCore)
    : undefined;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6">
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-detalle-visita"
        className="my-4 w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2
              id="titulo-detalle-visita"
              className="text-base font-semibold tracking-tight"
            >
              {visita.cliente}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-mono">{visita.id}</span> ·{" "}
              {formatearFecha(visita.fecha)} · {visita.tipo ?? "sin tipo"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {puedeEditar ? (
              <button
                type="button"
                onClick={onEditar}
                className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:border-white/10 dark:hover:bg-white/10"
              >
                Editar
              </button>
            ) : null}
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="cursor-pointer rounded-lg p-2 text-slate-600 transition-colors duration-200 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Dato etiqueta="Responsable" valor={visita.responsable} />
            <Dato
              etiqueta="Contacto"
              valor={
                contacto
                  ? `${contacto.nombre}${
                      contacto.funciones.length > 0
                        ? ` · ${contacto.funciones.join(", ")}`
                        : ""
                    }`
                  : // El serial suelto sigue siendo más útil que un guion:
                    // dice que sí se anotó a alguien, aunque ya no esté.
                    visita.idContactoCore
              }
            />
            <Dato etiqueta="Resultado" valor={visita.resultado} />
            <Dato etiqueta="Productos de interés" valor={visita.productos} />
          </dl>

          <dl className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-4 dark:border-white/10">
            <Bloque etiqueta="Objetivo" valor={visita.objetivo} />
            <Bloque
              etiqueta="Necesidad o diagnóstico"
              valor={visita.necesidad}
            />
            <Bloque etiqueta="Próxima acción" valor={visita.proximaAccion} />

            <div>
              <dt className={etiquetaDato}>Fecha del próximo seguimiento</dt>
              <dd className="mt-1 text-sm">
                {visita.fechaSeguimiento ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="tabular-nums">
                      {formatearFecha(visita.fechaSeguimiento)}
                    </span>
                    {visita.estadoSeguimiento ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                        {visita.estadoSeguimiento}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-500">
                    Sin pendiente agendado
                  </span>
                )}
              </dd>
            </div>

            <Bloque etiqueta="Pendientes" valor={visita.pendientes} />
            <Bloque etiqueta="Observaciones" valor={visita.observaciones} />
          </dl>

          {visita.modificadoPor ? (
            <p className="mt-5 border-t border-slate-200 pt-3 text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-500">
              Última modificación desde el CRM por {visita.modificadoPor}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string | null;
}) {
  return (
    <div>
      <dt className={etiquetaDato}>{etiqueta}</dt>
      <dd className="mt-1 text-sm">
        {valor ?? <span className="text-slate-500 dark:text-slate-500">—</span>}
      </dd>
    </div>
  );
}

/** Un campo de texto largo: se respetan los saltos de línea del dictado. */
function Bloque({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string | null;
}) {
  return (
    <div>
      <dt className={etiquetaDato}>{etiqueta}</dt>
      <dd className="mt-1 text-sm whitespace-pre-line">
        {valor ?? <span className="text-slate-500 dark:text-slate-500">—</span>}
      </dd>
    </div>
  );
}
