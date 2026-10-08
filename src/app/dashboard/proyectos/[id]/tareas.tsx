"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { formatearFecha } from "@/lib/fechas";
import type { TareaProyecto } from "@/lib/proyectos";
import {
  alertaTarea,
  ESTADOS_TAREA,
  type EstadoTarea,
} from "@/lib/proyectos-comun";
import { IconClose, IconPlus } from "../../icons";
import {
  AlertaTareaBadge,
  botonPrimario,
  botonSecundario,
  EstadoBadge,
  etiqueta,
  input,
  type PersonaOpcion,
} from "../comun";

export type TareaVista = TareaProyecto & { puedeAvanzar: boolean };

export function TareasProyecto({
  proyectoId,
  tareas,
  personal,
  sesion,
  gestiona,
  cerrado,
  hoy,
}: {
  proyectoId: string;
  tareas: TareaVista[];
  personal: PersonaOpcion[];
  sesion: { idEmpleado: string; nombre: string };
  gestiona: boolean;
  /** Proyecto finalizado o cancelado: no se agregan tareas. */
  cerrado: boolean;
  hoy: string;
}) {
  /** null: cerrado; "nueva": crear; una tarea: editarla. */
  const [enFormulario, setEnFormulario] = useState<TareaVista | "nueva" | null>(
    null,
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          Tareas{" "}
          <span className="font-normal text-slate-500 tabular-nums">
            ({tareas.length})
          </span>
        </h2>
        {gestiona && !cerrado ? (
          <button
            type="button"
            onClick={() => setEnFormulario("nueva")}
            className={`${botonSecundario} flex items-center gap-1.5 px-3 py-1.5`}
          >
            <IconPlus className="h-4 w-4" />
            Agregar tarea
          </button>
        ) : null}
      </div>

      {tareas.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          {gestiona && !cerrado
            ? "Arma el cronograma agregando las tareas de la prueba: preparación, aplicaciones, muestreos, evaluación."
            : "Este proyecto no tiene tareas."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
          {tareas.map((tarea) => (
            <FilaTarea
              key={tarea.recordId}
              proyectoId={proyectoId}
              tarea={tarea}
              esMia={tarea.idPersonalCore === sesion.idEmpleado}
              hoy={hoy}
              onEditar={() => setEnFormulario(tarea)}
            />
          ))}
        </ul>
      )}

      {enFormulario ? (
        <FormularioTarea
          proyectoId={proyectoId}
          tarea={enFormulario === "nueva" ? undefined : enFormulario}
          personal={personal}
          sesion={sesion}
          gestiona={gestiona}
          onCerrar={() => setEnFormulario(null)}
        />
      ) : null}
    </>
  );
}

function FilaTarea({
  proyectoId,
  tarea,
  esMia,
  hoy,
  onEditar,
}: {
  proyectoId: string;
  tarea: TareaVista;
  esMia: boolean;
  hoy: string;
  onEditar: () => void;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiarEstado(estado: string) {
    setOcupado(true);
    setError(null);
    const respuesta = await fetch(
      `/api/proyectos/${proyectoId}/tareas/${tarea.recordId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "estado", estado }),
      },
    );
    setOcupado(false);
    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos actualizar la tarea."));
      return;
    }
    router.refresh();
  }

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-64">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {tarea.tarea}
          <AlertaTareaBadge alerta={alertaTarea(tarea, hoy)} />
        </p>
        {tarea.descripcion ? (
          <p className="mt-0.5 text-xs whitespace-pre-line text-slate-600 dark:text-slate-400">
            {tarea.descripcion}
          </p>
        ) : null}
        {tarea.notas ? (
          <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs whitespace-pre-line text-slate-700 dark:bg-white/5 dark:text-slate-300">
            {tarea.notas}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-1 text-xs font-medium text-red-700 dark:text-red-400"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="w-40 text-sm">
        <span className={esMia ? "font-semibold" : undefined}>
          {tarea.responsable ?? "Sin encargado"}
        </span>
        <span className="block text-xs text-slate-500 tabular-nums dark:text-slate-400">
          {tarea.fechaInicio || tarea.fechaFin
            ? `${formatearFecha(tarea.fechaInicio)} – ${formatearFecha(tarea.fechaFin)}`
            : "Sin fechas"}
        </span>
        {tarea.fechaCompletada ? (
          <span className="block text-xs text-emerald-700 dark:text-emerald-400">
            hecha el {formatearFecha(tarea.fechaCompletada)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {tarea.puedeAvanzar ? (
          <>
            <label htmlFor={`estado-${tarea.recordId}`} className="sr-only">
              Estado de la tarea
            </label>
            <select
              id={`estado-${tarea.recordId}`}
              value={tarea.estado ?? "Pendiente"}
              disabled={ocupado}
              onChange={(e) => cambiarEstado(e.target.value)}
              className={`${input} w-auto cursor-pointer py-1 text-xs`}
            >
              {ESTADOS_TAREA.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onEditar}
              className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
            >
              Editar
            </button>
          </>
        ) : (
          <EstadoBadge estado={tarea.estado} />
        )}
      </div>
    </li>
  );
}

function FormularioTarea({
  proyectoId,
  tarea,
  personal,
  sesion,
  gestiona,
  onCerrar,
}: {
  proyectoId: string;
  tarea?: TareaVista;
  personal: PersonaOpcion[];
  sesion: { idEmpleado: string; nombre: string };
  /** Sin gestión del proyecto solo se mueven estado y notas. */
  gestiona: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const dialogoRef = useRef<HTMLDivElement>(null);

  const [datos, setDatos] = useState({
    tarea: tarea?.tarea ?? "",
    descripcion: tarea?.descripcion ?? "",
    encargadoId: tarea?.idPersonalCore ?? sesion.idEmpleado,
    fechaInicio: tarea?.fechaInicio ?? "",
    fechaFin: tarea?.fechaFin ?? "",
    estado: (tarea?.estado ?? "Pendiente") as EstadoTarea,
    notas: tarea?.notas ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si el encargado actual ya no está activo, se ofrece igual para no
  // reasignar la tarea en silencio al guardar otro cambio.
  const opciones =
    tarea?.idPersonalCore &&
    !personal.some((p) => p.idEmpleado === tarea.idPersonalCore)
      ? [
          { idEmpleado: tarea.idPersonalCore, nombre: tarea.responsable ?? tarea.idPersonalCore },
          ...personal,
        ]
      : personal;

  function actualizar(cambios: Partial<typeof datos>) {
    setDatos((previos) => ({ ...previos, ...cambios }));
  }

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  async function enviar(url: string, method: string, cuerpo: object) {
    const respuesta = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (respuesta.ok) return null;
    const data = await respuesta.json().catch(() => ({}));
    return String(data.error ?? "No pudimos guardar la tarea.");
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();

    if (gestiona && !datos.tarea.trim()) {
      setError("Escribe qué hay que hacer.");
      return;
    }
    if (datos.fechaInicio && datos.fechaFin && datos.fechaFin < datos.fechaInicio) {
      setError("La fecha de fin no puede ser anterior al inicio.");
      return;
    }

    setGuardando(true);
    setError(null);

    const planeacion = {
      tarea: datos.tarea,
      descripcion: datos.descripcion,
      encargadoId: datos.encargadoId,
      fechaInicio: datos.fechaInicio,
      fechaFin: datos.fechaFin,
    };

    let fallo: string | null;
    if (!tarea) {
      fallo = await enviar(`/api/proyectos/${proyectoId}/tareas`, "POST", planeacion);
    } else {
      const url = `/api/proyectos/${proyectoId}/tareas/${tarea.recordId}`;
      fallo = gestiona
        ? await enviar(url, "PATCH", { accion: "datos", ...planeacion })
        : null;
      if (!fallo) {
        fallo = await enviar(url, "PATCH", {
          accion: "estado",
          estado: datos.estado,
          notas: datos.notas,
        });
      }
    }

    setGuardando(false);
    if (fallo) {
      setError(fallo);
      return;
    }
    router.refresh();
    onCerrar();
  }

  const soloAvance = Boolean(tarea) && !gestiona;
  const lectura = `${input} mt-1 bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400`;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6">
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-tarea"
        className="my-4 w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <h2 id="titulo-tarea" className="text-base font-semibold tracking-tight">
            {tarea ? `Tarea ${tarea.id}` : "Nueva tarea"}
          </h2>
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
              <label htmlFor="tarea-titulo" className={etiqueta}>
                Tarea
              </label>
              {soloAvance ? (
                <p id="tarea-titulo" className={lectura}>
                  {datos.tarea}
                </p>
              ) : (
                <input
                  id="tarea-titulo"
                  required
                  value={datos.tarea}
                  onChange={(e) => actualizar({ tarea: e.target.value })}
                  placeholder="Primera aplicación en lote tratado"
                  className={`${input} mt-1`}
                />
              )}
            </div>

            {soloAvance ? null : (
              <div className="sm:col-span-2">
                <label htmlFor="tarea-descripcion" className={etiqueta}>
                  Descripción{" "}
                  <span className="font-normal text-slate-500">(opcional)</span>
                </label>
                <textarea
                  id="tarea-descripcion"
                  rows={2}
                  value={datos.descripcion}
                  onChange={(e) => actualizar({ descripcion: e.target.value })}
                  className={`${input} mt-1 resize-y`}
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label htmlFor="tarea-encargado" className={etiqueta}>
                Encargado
              </label>
              {soloAvance ? (
                <p id="tarea-encargado" className={lectura}>
                  {tarea?.responsable ?? "Sin encargado"}
                </p>
              ) : (
                <select
                  id="tarea-encargado"
                  value={datos.encargadoId}
                  onChange={(e) => actualizar({ encargadoId: e.target.value })}
                  className={`${input} mt-1 cursor-pointer`}
                >
                  {opciones.map((p) => (
                    <option key={p.idEmpleado} value={p.idEmpleado}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="tarea-inicio" className={etiqueta}>
                Inicio
              </label>
              {soloAvance ? (
                <p id="tarea-inicio" className={lectura}>
                  {formatearFecha(datos.fechaInicio || null)}
                </p>
              ) : (
                <input
                  id="tarea-inicio"
                  type="date"
                  value={datos.fechaInicio}
                  onChange={(e) => actualizar({ fechaInicio: e.target.value })}
                  className={`${input} mt-1`}
                />
              )}
            </div>

            <div>
              <label htmlFor="tarea-fin" className={etiqueta}>
                Fin
              </label>
              {soloAvance ? (
                <p id="tarea-fin" className={lectura}>
                  {formatearFecha(datos.fechaFin || null)}
                </p>
              ) : (
                <input
                  id="tarea-fin"
                  type="date"
                  min={datos.fechaInicio || undefined}
                  value={datos.fechaFin}
                  onChange={(e) => actualizar({ fechaFin: e.target.value })}
                  className={`${input} mt-1`}
                />
              )}
            </div>

            {tarea ? (
              <>
                <div>
                  <label htmlFor="tarea-estado" className={etiqueta}>
                    Estado
                  </label>
                  <select
                    id="tarea-estado"
                    value={datos.estado}
                    onChange={(e) =>
                      actualizar({ estado: e.target.value as EstadoTarea })
                    }
                    className={`${input} mt-1 cursor-pointer`}
                  >
                    {ESTADOS_TAREA.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="tarea-notas" className={etiqueta}>
                    Notas{" "}
                    <span className="font-normal text-slate-500">(opcional)</span>
                  </label>
                  <textarea
                    id="tarea-notas"
                    rows={3}
                    value={datos.notas}
                    onChange={(e) => actualizar({ notas: e.target.value })}
                    placeholder="Qué resultó, qué se midió o por qué está detenida"
                    className={`${input} mt-1 resize-y`}
                  />
                </div>
              </>
            ) : null}
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
            <button type="button" onClick={onCerrar} className={botonSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className={botonPrimario}>
              {guardando ? "Guardando…" : tarea ? "Guardar" : "Agregar tarea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
