"use client";

import { useEffect } from "react";

import type { Caso } from "@/lib/casos";
import { describirTipo } from "@/lib/casos-comun";
import { formatearFecha } from "@/lib/fechas";
import { IconClose } from "../icons";
import type { ContactoCaso } from "./modulo";

const etiquetaDato =
  "text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500";

/**
 * El caso completo, con su bitácora. El listado muestra el estado y el plazo;
 * aquí está la descripción entera, el seguimiento, la respuesta que se le dio
 * al cliente y quién tocó qué.
 */
export function DetalleCaso({
  caso,
  contactos,
  puedeEditar,
  onEditar,
  onCerrar,
}: {
  caso: Caso;
  contactos: ContactoCaso[];
  puedeEditar: boolean;
  onEditar: () => void;
  onCerrar: () => void;
}) {
  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  // El caso guarda el serial del contacto; el nombre vive en el directorio.
  const contacto = caso.idContactoCore
    ? contactos.find((c) => c.codigo === caso.idContactoCore)
    : undefined;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-detalle-caso"
        className="my-4 w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2
              id="titulo-detalle-caso"
              className="text-base font-semibold tracking-tight"
            >
              {caso.cliente}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-mono">{caso.id}</span> ·{" "}
              {describirTipo(caso.tipo, caso.tipoOtroDetalle) ?? "sin tipo"} ·{" "}
              {caso.estado ?? "sin estado"}
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
            <Dato
              etiqueta="Contacto"
              valor={contacto?.nombre ?? caso.idContactoCore}
            />
            <Dato
              etiqueta="Responsable del trámite"
              valor={caso.responsable}
            />
            <Dato
              etiqueta="Recibido o digitado por"
              valor={caso.recibidoPor}
            />
            <Dato
              etiqueta="Fecha de apertura"
              valor={formatearFecha(caso.fechaApertura)}
            />
            <Dato
              etiqueta="Fecha límite"
              valor={
                caso.fechaLimite ? formatearFecha(caso.fechaLimite) : null
              }
            />
            <Dato
              etiqueta="Fecha de cierre"
              valor={caso.fechaCierre ? formatearFecha(caso.fechaCierre) : null}
            />
          </dl>

          <dl className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-4 dark:border-white/10">
            <Bloque etiqueta="Descripción" valor={caso.descripcion} />
            <Bloque etiqueta="Seguimiento" valor={caso.seguimiento} />
            <Bloque
              etiqueta="Solución o respuesta final"
              valor={caso.solucionFinal}
            />
            <Bloque etiqueta="Observaciones" valor={caso.observaciones} />
          </dl>

          {caso.historial ? (
            <section className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10">
              <h3 className={etiquetaDato}>Historial de cambios</h3>
              <ol className="mt-2 flex flex-col gap-1">
                {caso.historial
                  .split("\n")
                  .filter((linea) => linea.trim())
                  .map((linea, indice) => (
                    <li
                      key={`${indice}-${linea.slice(0, 24)}`}
                      className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700 dark:bg-white/5 dark:text-slate-300"
                    >
                      {linea}
                    </li>
                  ))}
              </ol>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
                El historial no se puede editar: solo se le agregan líneas.
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div>
      <dt className={etiquetaDato}>{etiqueta}</dt>
      <dd className="mt-1 text-sm">
        {valor ?? <span className="text-slate-500 dark:text-slate-500">—</span>}
      </dd>
    </div>
  );
}

/** Un campo de texto largo: se respetan los saltos de línea. */
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
