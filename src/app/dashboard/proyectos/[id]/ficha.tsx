"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { ClienteCore } from "@/lib/clientes";
import { formatearFecha } from "@/lib/fechas";
import type { Proyecto } from "@/lib/proyectos";
import {
  calcularAvance,
  diasEntre,
  exigeResultados,
  proyectoAtrasado,
  proyectoCerrado,
  VEREDICTOS,
  type EstadoProyecto,
} from "@/lib/proyectos-comun";
import { IconChevronLeft, IconClose } from "../../icons";
import {
  BarraAvance,
  botonPrimario,
  botonSecundario,
  card,
  EstadoBadge,
  etiqueta,
  input,
  VeredictoBadge,
  type CultivoOpcion,
  type PersonaOpcion,
  type ProductoOpcion,
} from "../comun";
import { FormularioProyecto } from "../formulario-proyecto";
import { Cronograma } from "./cronograma";
import { TareasProyecto, type TareaVista } from "./tareas";

/** El paso siguiente natural de cada estado abierto. */
const SIGUIENTE: Partial<Record<string, { estado: EstadoProyecto; texto: string }>> = {
  Planeación: { estado: "En ejecución", texto: "Iniciar ejecución" },
  "En ejecución": { estado: "En evaluación", texto: "Pasar a evaluación" },
  "En evaluación": { estado: "Finalizado", texto: "Finalizar prueba" },
};

export function FichaProyecto({
  proyecto,
  tareas,
  clientes,
  cultivos,
  productos,
  personal,
  sesion,
  gestiona,
  puedeAnotar,
  puedeCambiarLider,
  hoy,
}: {
  proyecto: Proyecto;
  tareas: TareaVista[];
  clientes: ClienteCore[];
  cultivos: CultivoOpcion[];
  productos: ProductoOpcion[];
  personal: PersonaOpcion[];
  sesion: { idEmpleado: string; nombre: string };
  gestiona: boolean;
  puedeAnotar: boolean;
  puedeCambiarLider: boolean;
  hoy: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  /** Estado al que se va a mover y que pide resultados antes. */
  const [cerrandoHacia, setCerrandoHacia] = useState<EstadoProyecto | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avance = calcularAvance(tareas, hoy);
  const cerrado = proyectoCerrado(proyecto.estado);
  const atrasado = proyectoAtrasado(proyecto, hoy);
  const siguiente = SIGUIENTE[proyecto.estado ?? ""];

  async function moverA(estado: EstadoProyecto) {
    if (exigeResultados(estado)) {
      setCerrandoHacia(estado);
      return;
    }
    if (
      estado === "Cancelado" &&
      !window.confirm("¿Cancelar este proyecto? Puedes reabrirlo después.")
    ) {
      return;
    }
    setOcupado(true);
    setError(null);
    const respuesta = await fetch(`/api/proyectos/${proyecto.recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "estado", estado }),
    });
    setOcupado(false);
    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos cambiar el estado."));
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
      <div>
        <Link
          href="/dashboard/proyectos"
          className="inline-flex items-center gap-1 rounded text-sm text-slate-600 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-400"
        >
          <IconChevronLeft className="h-4 w-4" />
          Proyectos
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 tabular-nums">
              {proyecto.id}
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
              {proyecto.nombre}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {[proyecto.cliente, proyecto.cultivo, proyecto.ubicacion]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EstadoBadge estado={proyecto.estado} />
              <VeredictoBadge veredicto={proyecto.veredicto} />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Líder: {proyecto.responsable ?? "—"}
              </span>
            </div>
          </div>

          {gestiona ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEditando(true)}
                className={botonSecundario}
              >
                Editar
              </button>
              {cerrado ? (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => moverA("En evaluación")}
                  className={botonSecundario}
                >
                  Reabrir
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => moverA("Cancelado")}
                    className={botonSecundario}
                  >
                    Cancelar proyecto
                  </button>
                  {siguiente ? (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => moverA(siguiente.estado)}
                      className={botonPrimario}
                    >
                      {siguiente.texto}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/15 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${card} p-5`}>
          <p className="text-sm text-slate-600 dark:text-slate-400">Avance</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {avance.porcentaje === null ? "—" : `${avance.porcentaje}%`}
          </p>
          <div className="mt-2">
            <BarraAvance
              porcentaje={avance.porcentaje}
              completadas={avance.completadas}
              total={avance.total}
            />
          </div>
        </div>
        <Dato
          titulo="Tareas vencidas"
          valor={String(avance.vencidas)}
          tono={avance.vencidas > 0 ? "rojo" : undefined}
        />
        <Dato
          titulo="Fechas"
          valor={`${formatearFecha(proyecto.fechaInicio)} – ${formatearFecha(proyecto.fechaFinPlaneada)}`}
          pequeno
        />
        <Dato
          titulo={cerrado ? "Cerrado" : atrasado ? "Atrasado" : "Quedan"}
          valor={
            cerrado
              ? formatearFecha(proyecto.fechaCierre)
              : proyecto.fechaFinPlaneada
                ? plural(Math.abs(diasEntre(hoy, proyecto.fechaFinPlaneada)), "día", "días")
                : "—"
          }
          tono={atrasado ? "ambar" : undefined}
          pequeno={cerrado}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <section className={`${card} p-5`}>
            <h2 className="mb-3 text-base font-semibold tracking-tight">
              Cronograma
            </h2>
            <Cronograma proyecto={proyecto} tareas={tareas} hoy={hoy} />
          </section>

          <section className={`${card} p-5`}>
            <TareasProyecto
              proyectoId={proyecto.recordId}
              tareas={tareas}
              personal={personal}
              sesion={sesion}
              gestiona={gestiona}
              cerrado={cerrado}
              hoy={hoy}
            />
          </section>

          <Resultados proyecto={proyecto} gestiona={gestiona} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className={`${card} p-5`}>
            <h2 className="text-base font-semibold tracking-tight">La prueba</h2>
            <dl className="mt-3 flex flex-col gap-4 text-sm">
              <Texto titulo="Objetivo" valor={proyecto.objetivo} />
              <Texto titulo="Productos" valor={proyecto.productos} />
              <Texto titulo="Metodología" valor={proyecto.metodologia} />
              <Texto titulo="Indicadores" valor={proyecto.indicadores} />
              <Texto titulo="Observaciones" valor={proyecto.observaciones} />
            </dl>
          </section>

          <Bitacora proyecto={proyecto} puedeAnotar={puedeAnotar} />

          {proyecto.historial ? (
            <section className={`${card} p-5`}>
              <details>
                <summary className="cursor-pointer text-sm font-semibold">
                  Historial de cambios
                </summary>
                <ul className="mt-3 flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  {proyecto.historial
                    .split("\n")
                    .reverse()
                    .map((linea, i) => (
                      <li key={i}>{linea}</li>
                    ))}
                </ul>
              </details>
            </section>
          ) : null}
        </div>
      </div>

      {editando ? (
        <FormularioProyecto
          clientes={clientes}
          productos={productos}
          cultivos={cultivos}
          personal={personal}
          proyecto={proyecto}
          sesion={sesion}
          puedeElegirLider={puedeCambiarLider}
          hoy={hoy}
          onCerrar={() => setEditando(false)}
        />
      ) : null}

      {cerrandoHacia ? (
        <ModalCierre
          proyecto={proyecto}
          estado={cerrandoHacia}
          tareasAbiertas={avance.total - avance.completadas}
          onCerrar={() => setCerrandoHacia(null)}
        />
      ) : null}
    </div>
  );
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function Dato({
  titulo,
  valor,
  tono,
  pequeno,
}: {
  titulo: string;
  valor: string;
  tono?: "rojo" | "ambar";
  pequeno?: boolean;
}) {
  const color =
    tono === "rojo"
      ? "text-red-700 dark:text-red-400"
      : tono === "ambar"
        ? "text-amber-700 dark:text-amber-400"
        : "text-slate-900 dark:text-slate-100";
  return (
    <div className={`${card} p-5`}>
      <p className="text-sm text-slate-600 dark:text-slate-400">{titulo}</p>
      <p
        className={`mt-1 font-semibold tabular-nums ${pequeno ? "text-base" : "text-2xl"} ${color}`}
      >
        {valor}
      </p>
    </div>
  );
}

function Texto({ titulo, valor }: { titulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {titulo}
      </dt>
      <dd className="mt-0.5 whitespace-pre-line">{valor}</dd>
    </div>
  );
}

/* ------------------------------- Bitácora ------------------------------- */

function Bitacora({
  proyecto,
  puedeAnotar,
}: {
  proyecto: Proyecto;
  puedeAnotar: boolean;
}) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lo más reciente arriba: es lo que se viene a mirar.
  const entradas = (proyecto.bitacora ?? "")
    .split("\n")
    .filter((linea) => linea.trim())
    .reverse();

  async function anotar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!nota.trim()) return;
    setGuardando(true);
    setError(null);
    const respuesta = await fetch(`/api/proyectos/${proyecto.recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "bitacora", nota }),
    });
    setGuardando(false);
    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos guardar el avance."));
      return;
    }
    setNota("");
    router.refresh();
  }

  return (
    <section className={`${card} p-5`}>
      <h2 className="text-base font-semibold tracking-tight">Bitácora</h2>

      {puedeAnotar ? (
        <form onSubmit={anotar} className="mt-3">
          <label htmlFor="bitacora-nota" className="sr-only">
            Nuevo avance
          </label>
          <textarea
            id="bitacora-nota"
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Qué se hizo u observó hoy en campo"
            className={`${input} resize-y`}
          />
          {error ? (
            <p role="alert" className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={guardando || !nota.trim()}
              className={`${botonSecundario} px-3 py-1.5`}
            >
              {guardando ? "Guardando…" : "Anotar"}
            </button>
          </div>
        </form>
      ) : null}

      {entradas.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Sin avances anotados.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {entradas.map((linea, i) => {
            const partes = linea.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.*?)\s*·\s*(.*)$/);
            return (
              <li key={i} className="text-sm">
                {partes ? (
                  <>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatearFecha(partes[1])} · {partes[2]}
                    </p>
                    <p className="mt-0.5">{partes[3]}</p>
                  </>
                ) : (
                  <p>{linea}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------ Resultados ------------------------------ */

function Resultados({
  proyecto,
  gestiona,
}: {
  proyecto: Proyecto;
  gestiona: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState({
    resultados: proyecto.resultados ?? "",
    veredicto: proyecto.veredicto ?? "",
    conclusion: proyecto.conclusion ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hayResultados =
    proyecto.resultados || proyecto.veredicto || proyecto.conclusion;

  // Los resultados se escriben cuando hay algo que medir: desde la evaluación.
  const enEtapaDeResultados =
    proyecto.estado === "En evaluación" || proyectoCerrado(proyecto.estado);
  if (!hayResultados && !(gestiona && enEtapaDeResultados)) return null;

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    const respuesta = await fetch(`/api/proyectos/${proyecto.recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "resultados", ...datos }),
    });
    setGuardando(false);
    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos guardar los resultados."));
      return;
    }
    setEditando(false);
    router.refresh();
  }

  return (
    <section className={`${card} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">Resultados</h2>
        {gestiona && !editando ? (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className={`${botonSecundario} px-3 py-1.5`}
          >
            {hayResultados ? "Editar" : "Registrar resultados"}
          </button>
        ) : null}
      </div>

      {editando ? (
        <form onSubmit={guardar} className="mt-3">
          <CamposCierre datos={datos} onCambio={(c) => setDatos({ ...datos, ...c })} />
          {error ? (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/15 dark:text-red-300">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(false)} className={botonSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className={botonPrimario}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      ) : hayResultados ? (
        <dl className="mt-3 flex flex-col gap-4 text-sm">
          {proyecto.veredicto ? (
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Veredicto</dt>
              <dd className="mt-1">
                <VeredictoBadge veredicto={proyecto.veredicto} />
              </dd>
            </div>
          ) : null}
          <Texto titulo="Resultados medidos" valor={proyecto.resultados} />
          <Texto titulo="Conclusión" valor={proyecto.conclusion} />
        </dl>
      ) : (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Sin resultados registrados.
        </p>
      )}
    </section>
  );
}

type DatosCierre = { resultados: string; veredicto: string; conclusion: string };

function CamposCierre({
  datos,
  onCambio,
  obligatorio,
}: {
  datos: DatosCierre;
  onCambio: (cambios: Partial<DatosCierre>) => void;
  obligatorio?: boolean;
}) {
  return (
    <div className="grid gap-4">
      <div>
        <label htmlFor="cierre-resultados" className={etiqueta}>
          Resultados medidos
        </label>
        <textarea
          id="cierre-resultados"
          rows={4}
          required={obligatorio}
          value={datos.resultados}
          onChange={(e) => onCambio({ resultados: e.target.value })}
          placeholder="Lo que se midió en el tratamiento frente al testigo"
          className={`${input} mt-1 resize-y`}
        />
      </div>
      <div>
        <label htmlFor="cierre-veredicto" className={etiqueta}>
          Veredicto
        </label>
        <select
          id="cierre-veredicto"
          required={obligatorio}
          value={datos.veredicto}
          onChange={(e) => onCambio({ veredicto: e.target.value })}
          className={`${input} mt-1 cursor-pointer`}
        >
          <option value="">Sin definir</option>
          {VEREDICTOS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="cierre-conclusion" className={etiqueta}>
          Conclusión{" "}
          <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <textarea
          id="cierre-conclusion"
          rows={3}
          value={datos.conclusion}
          onChange={(e) => onCambio({ conclusion: e.target.value })}
          placeholder="Qué se decide: escalar a más área, repetir, descartar"
          className={`${input} mt-1 resize-y`}
        />
      </div>
    </div>
  );
}

function ModalCierre({
  proyecto,
  estado,
  tareasAbiertas,
  onCerrar,
}: {
  proyecto: Proyecto;
  estado: EstadoProyecto;
  tareasAbiertas: number;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [datos, setDatos] = useState<DatosCierre>({
    resultados: proyecto.resultados ?? "",
    veredicto: proyecto.veredicto ?? "",
    conclusion: proyecto.conclusion ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    const respuesta = await fetch(`/api/proyectos/${proyecto.recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "estado", estado, ...datos }),
    });
    setGuardando(false);
    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos finalizar el proyecto."));
      return;
    }
    router.refresh();
    onCerrar();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-cierre"
        className="my-4 w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <h2 id="titulo-cierre" className="text-base font-semibold tracking-tight">
            Finalizar {proyecto.id}
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
          {tareasAbiertas > 0 ? (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
              Quedan {plural(tareasAbiertas, "tarea abierta", "tareas abiertas")}.
            </p>
          ) : null}
          <CamposCierre
            datos={datos}
            obligatorio
            onCambio={(c) => setDatos({ ...datos, ...c })}
          />
          {error ? (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/15 dark:text-red-300">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
            <button type="button" onClick={onCerrar} className={botonSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className={botonPrimario}>
              {guardando ? "Guardando…" : "Finalizar prueba"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
