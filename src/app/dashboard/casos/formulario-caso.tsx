"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { Caso } from "@/lib/casos";
import {
  ESTADOS_CASO,
  exigeSolucion,
  TIPO_OTRO,
  TIPOS_CASO_ANTERIORES,
  TIPOS_PQRSF,
  type EstadoCaso,
  type TipoCaso,
} from "@/lib/casos-comun";
import type { ClienteCore } from "@/lib/clientes";
import { formatearFecha } from "@/lib/fechas";
import { IconClose } from "../icons";
import type { ContactoCaso, VisitaOrigen } from "./modulo";

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
  /** Solo se usa cuando el tipo es "Otro". */
  tipoOtroDetalle: string;
  /** Codigo Persona Cliente de quien reportó el caso; "" si no se anotó. */
  contactoCodigo: string;
  fechaApertura: string;
  tipo: TipoCaso;
  descripcion: string;
  responsableId: string;
  estado: "Abierto" | "En proceso";
  fechaLimite: string;
  seguimiento: string;
  solucionFinal: string;
  observaciones: string;
  visitaOrigen: string;
};

function vacio(hoy: string, idEmpleado: string): Formulario {
  return {
    clienteId: "",
    contactoCodigo: "",
    fechaApertura: hoy,
    // PQRSF es lo que se ofrece por defecto al abrir un caso nuevo.
    tipo: "Petición",
    tipoOtroDetalle: "",
    descripcion: "",
    responsableId: idEmpleado,
    estado: "Abierto",
    fechaLimite: "",
    seguimiento: "",
    solucionFinal: "",
    observaciones: "",
    visitaOrigen: "",
  };
}

/** Precarga el formulario con lo que ya tiene el caso que se va a corregir. */
function desdeCaso(
  caso: Caso,
  clientes: ClienteCore[],
  hoy: string,
  idEmpleado: string,
): Formulario {
  return {
    ...vacio(hoy, idEmpleado),
    // El cliente no se edita, pero se resuelve desde su serial para poder
    // filtrar los contactos. Queda vacío si el cliente está inactivo.
    clienteId:
      clientes.find((cliente) => cliente.id === caso.idClienteCore)?.recordId ??
      "",
    contactoCodigo: caso.idContactoCore ?? "",
    fechaApertura: caso.fechaApertura ?? hoy,
    tipo: (caso.tipo as TipoCaso) ?? "Petición",
    tipoOtroDetalle: caso.tipoOtroDetalle ?? "",
    descripcion: caso.descripcion ?? "",
    fechaLimite: caso.fechaLimite ?? "",
    seguimiento: caso.seguimiento ?? "",
    solucionFinal: caso.solucionFinal ?? "",
    observaciones: caso.observaciones ?? "",
  };
}

export function FormularioCaso({
  clientes,
  contactos,
  visitas,
  personal,
  caso,
  sesion,
  hoy,
  onCerrar,
}: {
  clientes: ClienteCore[];
  contactos: ContactoCaso[];
  visitas: VisitaOrigen[];
  personal: { nombre: string; rol: string | null; idEmpleado: string }[];
  /** Presente al corregir un caso ya abierto; ausente al abrir uno nuevo. */
  caso?: Caso;
  sesion: { idEmpleado: string; nombre: string };
  hoy: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const dialogoRef = useRef<HTMLDivElement>(null);

  const { idEmpleado, nombre: usuario } = sesion;
  const editando = Boolean(caso);
  // Un caso ya cerrado no puede quedarse sin la respuesta que lo cerró.
  const solucionObligatoria = exigeSolucion(caso?.estado ?? null);

  const [datos, setDatos] = useState<Formulario>(() =>
    caso
      ? desdeCaso(caso, clientes, hoy, sesion.idEmpleado)
      : vacio(hoy, sesion.idEmpleado),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cliente = clientes.find((c) => c.recordId === datos.clienteId);

  /**
   * El tipo de la clasificación anterior que este caso ya traía, si lo trae.
   * Es lo único de esa lista que se sigue ofreciendo, y solo al editar.
   */
  const tipoHeredado = TIPOS_CASO_ANTERIORES.find(
    (anterior) => anterior === datos.tipo,
  );

  const esOtro = datos.tipo === TIPO_OTRO;

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

  /**
   * Los contactos del cliente. El ya anotado se ofrece siempre, aunque esté
   * inactivo: si no, corregir otro campo de un caso viejo lo borraría en
   * silencio.
   */
  const contactosDelCliente = contactos.filter(
    (contacto) =>
      contacto.codigo === datos.contactoCodigo ||
      (contacto.activo && contacto.clientes.includes(datos.clienteId)),
  );

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

    // Al editar el cliente no se toca: viene del registro, no del formulario.
    if (!editando && !cliente) {
      setError("Elige el cliente que abrió el requerimiento.");
      return;
    }
    if (!datos.descripcion.trim()) {
      setError("Describe el requerimiento del cliente.");
      return;
    }
    if (esOtro && !datos.tipoOtroDetalle.trim()) {
      setError("Elegiste «Otro»: escribe de qué se trata el requerimiento.");
      return;
    }
    if (datos.fechaLimite && datos.fechaLimite < datos.fechaApertura) {
      setError("La fecha límite no puede ser anterior a la apertura.");
      return;
    }
    if (solucionObligatoria && !datos.solucionFinal.trim()) {
      setError(
        "Este caso está cerrado: no puedes dejarlo sin solución o respuesta final.",
      );
      return;
    }

    setGuardando(true);
    setError(null);

    const respuesta = caso
      ? await fetch(`/api/casos/${caso.recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accion: "datos",
            idContactoCore: datos.contactoCodigo,
            tipo: datos.tipo,
            tipoOtroDetalle: esOtro ? datos.tipoOtroDetalle : "",
            descripcion: datos.descripcion,
            fechaLimite: datos.fechaLimite,
            seguimiento: datos.seguimiento,
            solucionFinal: datos.solucionFinal,
            observaciones: datos.observaciones,
          }),
        })
      : await fetch("/api/casos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idClienteCore: cliente?.id,
            cliente: cliente?.nombre,
            idContactoCore: datos.contactoCodigo,
            fechaApertura: datos.fechaApertura,
            tipo: datos.tipo,
            tipoOtroDetalle: esOtro ? datos.tipoOtroDetalle : "",
            descripcion: datos.descripcion,
            responsableId: datos.responsableId,
            estado: datos.estado,
            fechaLimite: datos.fechaLimite,
            seguimiento: datos.seguimiento,
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
              {editando ? `Editar caso ${caso?.id ?? ""}` : "Abrir caso"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Se guarda en la base Sirius CRM · tabla Casos
              {editando
                ? " · el estado se cambia desde el listado"
                : ""}
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
              <label htmlFor="caso-cliente" className={etiqueta}>
                Cliente
              </label>
              {/* Un caso de otra empresa es otro caso, no una corrección. */}
              {editando ? (
                <p
                  id="caso-cliente"
                  className={`${input} mt-1 bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400`}
                >
                  {caso?.cliente ?? "Sin cliente"}
                </p>
              ) : (
                <select
                  id="caso-cliente"
                  required
                  value={datos.clienteId}
                  onChange={(e) =>
                    // La visita de origen y el contacto eran del cliente
                    // anterior: se descartan.
                    actualizar({
                      clienteId: e.target.value,
                      visitaOrigen: "",
                      contactoCodigo: "",
                    })
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
              )}
            </div>

            <div>
              <label htmlFor="caso-contacto" className={etiqueta}>
                Contacto que reportó{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <select
                id="caso-contacto"
                value={datos.contactoCodigo}
                disabled={!datos.clienteId && !datos.contactoCodigo}
                onChange={(e) =>
                  actualizar({ contactoCodigo: e.target.value })
                }
                className={`${input} mt-1 cursor-pointer`}
              >
                <option value="">
                  {datos.clienteId || datos.contactoCodigo
                    ? "Sin anotar"
                    : "Elige primero el cliente"}
                </option>
                {contactosDelCliente.map((contacto) => (
                  <option key={contacto.codigo} value={contacto.codigo}>
                    {contacto.nombre}
                    {contacto.funciones.length > 0
                      ? ` · ${contacto.funciones.join(", ")}`
                      : ""}
                    {contacto.activo ? "" : " (inactivo)"}
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
                  actualizar({
                    tipo: e.target.value as TipoCaso,
                    tipoOtroDetalle:
                      e.target.value === TIPO_OTRO ? datos.tipoOtroDetalle : "",
                  })
                }
                className={`${input} mt-1 cursor-pointer`}
              >
                {TIPOS_PQRSF.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
                {/* Solo el valor que este caso ya tenía, cuando viene de la
                    clasificación anterior: se conserva para no forzar una
                    reclasificación al corregir cualquier otro campo, pero no
                    se ofrece como alternativa al abrir un caso nuevo. */}
                {tipoHeredado ? (
                  <optgroup label="Clasificación anterior">
                    <option value={tipoHeredado}>{tipoHeredado}</option>
                  </optgroup>
                ) : null}
              </select>
              {tipoHeredado ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                  Este caso se abrió con la clasificación anterior. Puedes
                  dejarlo así o pasarlo a PQRSF.
                </p>
              ) : null}
            </div>

            {/* «Otro» a secas no clasifica nada: dentro de un mes nadie sabría
                de qué tipo era el caso. */}
            {esOtro ? (
              <div>
                <label htmlFor="caso-tipo-otro" className={etiqueta}>
                  ¿De qué se trata?
                  <span className="text-red-600 dark:text-red-400"> *</span>
                </label>
                <input
                  id="caso-tipo-otro"
                  required
                  value={datos.tipoOtroDetalle}
                  onChange={(e) =>
                    actualizar({ tipoOtroDetalle: e.target.value })
                  }
                  placeholder="Devolución, garantía, solicitud de muestra…"
                  className={`${input} mt-1`}
                />
              </div>
            ) : null}

            <div className={editando ? "hidden" : undefined}>
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

            <div className={editando ? "hidden" : undefined}>
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

            <div className={editando ? "hidden" : undefined}>
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

            <div className={editando ? "hidden" : undefined}>
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
              <label htmlFor="caso-seguimiento" className={etiqueta}>
                Seguimiento{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <textarea
                id="caso-seguimiento"
                rows={3}
                value={datos.seguimiento}
                onChange={(e) => actualizar({ seguimiento: e.target.value })}
                placeholder="Qué se ha hecho hasta ahora: se llamó al cliente, se programó visita técnica…"
                className={`${input} mt-1 resize-y`}
              />
            </div>

            {/* Solo al editar: al abrir el caso todavía no hay respuesta. */}
            {editando ? (
              <div className="sm:col-span-2">
                <label htmlFor="caso-solucion" className={etiqueta}>
                  Solución o respuesta final
                  {solucionObligatoria ? (
                    <span className="text-red-600 dark:text-red-400"> *</span>
                  ) : (
                    <span className="font-normal text-slate-500">
                      {" "}
                      (obligatoria al cerrar)
                    </span>
                  )}
                </label>
                <textarea
                  id="caso-solucion"
                  rows={3}
                  required={solucionObligatoria}
                  value={datos.solucionFinal}
                  onChange={(e) =>
                    actualizar({ solucionFinal: e.target.value })
                  }
                  placeholder="Lo que se le respondió al cliente y cómo quedó el caso."
                  className={`${input} mt-1 resize-y`}
                />
              </div>
            ) : null}

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
              {guardando
                ? "Guardando…"
                : editando
                  ? "Guardar cambios"
                  : "Abrir caso"}
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
