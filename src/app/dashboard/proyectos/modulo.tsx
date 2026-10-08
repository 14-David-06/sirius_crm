"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ClienteCore } from "@/lib/clientes";
import { formatearFecha } from "@/lib/fechas";
import type { Permisos } from "@/lib/permisos";
import type { Proyecto } from "@/lib/proyectos";
import {
  ESTADOS_PROYECTO,
  proyectoCerrado,
  type Avance,
  type EstadoProyecto,
} from "@/lib/proyectos-comun";
import { IconAlert, IconFilter, IconPlus, IconSearch } from "../icons";
import {
  BarraAvance,
  botonPrimario,
  card,
  EstadoBadge,
  input,
  VeredictoBadge,
  type CultivoOpcion,
  type PersonaOpcion,
  type ProductoOpcion,
} from "./comun";
import { FormularioProyecto } from "./formulario-proyecto";

export type FilaProyecto = {
  proyecto: Proyecto;
  avance: Avance;
  atrasado: boolean;
  /** Tareas abiertas de esta sesión en el proyecto. */
  misTareasAbiertas: number;
};

type Props = {
  filas: FilaProyecto[];
  clientes: ClienteCore[];
  cultivos: CultivoOpcion[];
  productos: ProductoOpcion[];
  personal: PersonaOpcion[];
  sesion: { idEmpleado: string; nombre: string };
  hoy: string;
  permisos: Permisos;
};

const ORDEN_ESTADO: Record<string, number> = {
  "En ejecución": 0,
  "En evaluación": 1,
  Planeación: 2,
  Finalizado: 3,
  Cancelado: 4,
};

export function ModuloProyectos({
  filas,
  clientes,
  cultivos,
  productos,
  personal,
  sesion,
  hoy,
  permisos,
}: Props) {
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("activos");
  const [lider, setLider] = useState("");

  const lideres = useMemo(() => {
    const valores = new Set<string>();
    for (const { proyecto } of filas) {
      if (proyecto.responsable) valores.add(proyecto.responsable);
    }
    return [...valores].sort((a, b) => a.localeCompare(b, "es"));
  }, [filas]);

  const resumen = useMemo(() => {
    const finalizados = filas.filter(
      (f) => f.proyecto.estado === "Finalizado",
    );
    return {
      activos: filas.filter((f) => !proyectoCerrado(f.proyecto.estado)).length,
      tareasVencidas: filas.reduce((suma, f) => suma + f.avance.vencidas, 0),
      atrasados: filas.filter((f) => f.atrasado).length,
      exitosas: finalizados.filter((f) => f.proyecto.veredicto === "Exitosa")
        .length,
      finalizados: finalizados.length,
    };
  }, [filas]);

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return filas
      .filter(({ proyecto }) => {
        const texto =
          `${proyecto.id} ${proyecto.nombre} ${proyecto.cliente} ${proyecto.cultivo ?? ""} ${proyecto.productos ?? ""} ${proyecto.responsable ?? ""}`.toLowerCase();
        if (termino && !texto.includes(termino)) return false;
        if (estado === "activos" && proyectoCerrado(proyecto.estado)) {
          return false;
        }
        if (
          ESTADOS_PROYECTO.includes(estado as EstadoProyecto) &&
          proyecto.estado !== estado
        ) {
          return false;
        }
        if (lider && proyecto.responsable !== lider) return false;
        return true;
      })
      .sort(
        (a, b) =>
          (ORDEN_ESTADO[a.proyecto.estado ?? ""] ?? 9) -
            (ORDEN_ESTADO[b.proyecto.estado ?? ""] ?? 9) ||
          (a.proyecto.fechaFinPlaneada ?? "9999").localeCompare(
            b.proyecto.fechaFinPlaneada ?? "9999",
          ),
      );
  }, [filas, busqueda, estado, lider]);

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Pruebas de campo con clientes: objetivo, cronograma, tareas y
            resultados.
          </p>
        </div>

        {permisos.crear ? (
          <button
            type="button"
            onClick={() => setFormularioAbierto(true)}
            className={`${botonPrimario} flex items-center gap-2`}
          >
            <IconPlus className="h-4 w-4" />
            Nuevo proyecto
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Resumen titulo="Activos" valor={String(resumen.activos)} />
        <Resumen
          titulo="Tareas vencidas"
          valor={String(resumen.tareasVencidas)}
          tono={resumen.tareasVencidas > 0 ? "rojo" : undefined}
        />
        <Resumen
          titulo="Pasados de su fecha de fin"
          valor={String(resumen.atrasados)}
          tono={resumen.atrasados > 0 ? "ambar" : undefined}
        />
        <Resumen
          titulo="Pruebas exitosas"
          valor={
            resumen.finalizados === 0
              ? "—"
              : `${resumen.exitosas} de ${resumen.finalizados}`
          }
        />
      </div>

      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1 lg:max-w-md">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <label htmlFor="buscar-proyecto" className="sr-only">
              Buscar proyectos
            </label>
            <input
              id="buscar-proyecto"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, cliente, cultivo o producto…"
              className={`${input} pl-9`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            <IconFilter className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <label htmlFor="filtro-estado-proyecto" className="sr-only">
              Estado del proyecto
            </label>
            <select
              id="filtro-estado-proyecto"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className={`${input} w-auto cursor-pointer`}
            >
              <option value="activos">Activos</option>
              {ESTADOS_PROYECTO.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
              <option value="todos">Todos</option>
            </select>

            <label htmlFor="filtro-lider-proyecto" className="sr-only">
              Líder
            </label>
            <select
              id="filtro-lider-proyecto"
              value={lider}
              onChange={(e) => setLider(e.target.value)}
              className={`${input} w-auto cursor-pointer`}
            >
              <option value="">Todo líder</option>
              {lideres.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </div>
        </div>

        {visibles.length === 0 ? (
          <div className="mt-8 pb-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filas.length === 0
                ? "Todavía no hay proyectos."
                : "Ningún proyecto coincide con estos filtros."}
            </p>
            {filas.length === 0 && permisos.crear ? (
              <button
                type="button"
                onClick={() => setFormularioAbierto(true)}
                className="mt-4 cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
              >
                Crear el primer proyecto
              </button>
            ) : null}
          </div>
        ) : (
          <div className="-mx-5 mt-4 overflow-x-auto">
            <table className="w-full min-w-[62rem] text-sm">
              <thead>
                <tr className="border-y border-slate-200 text-left text-xs tracking-wide text-slate-600 uppercase dark:border-white/10 dark:text-slate-400">
                  {[
                    "Proyecto",
                    "Cliente",
                    "Líder",
                    "Fechas",
                    "Avance",
                    "Estado",
                  ].map((columna) => (
                    <th
                      key={columna}
                      scope="col"
                      className="px-5 py-2.5 font-semibold whitespace-nowrap"
                    >
                      {columna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {visibles.map((fila) => (
                  <Fila key={fila.proyecto.recordId} fila={fila} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formularioAbierto ? (
        <FormularioProyecto
          clientes={clientes}
          productos={productos}
          cultivos={cultivos}
          personal={personal}
          sesion={sesion}
          puedeElegirLider={permisos.verTodo}
          hoy={hoy}
          onCerrar={() => setFormularioAbierto(false)}
        />
      ) : null}
    </div>
  );
}

function Fila({ fila }: { fila: FilaProyecto }) {
  const { proyecto, avance, atrasado, misTareasAbiertas } = fila;
  return (
    <tr className="align-top transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-white/5">
      <td className="px-5 py-3">
        <Link
          href={`/dashboard/proyectos/${proyecto.recordId}`}
          className="group block rounded focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
        >
          <span className="block text-xs font-semibold text-slate-500 tabular-nums">
            {proyecto.id}
          </span>
          <span className="mt-0.5 block max-w-xs font-medium text-slate-900 group-hover:underline dark:text-slate-100">
            {proyecto.nombre}
          </span>
          {proyecto.productos ? (
            <span className="mt-0.5 line-clamp-1 block max-w-xs text-xs text-slate-600 dark:text-slate-400">
              {proyecto.productos}
            </span>
          ) : null}
        </Link>
        {misTareasAbiertas > 0 ? (
          <span className="mt-1 inline-flex rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">
            {misTareasAbiertas}{" "}
            {misTareasAbiertas === 1 ? "tarea tuya" : "tareas tuyas"}
          </span>
        ) : null}
      </td>
      <td className="px-5 py-3">
        {proyecto.cliente}
        {proyecto.cultivo ? (
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {proyecto.cultivo}
          </span>
        ) : null}
      </td>
      <td className="px-5 py-3">{proyecto.responsable ?? "—"}</td>
      <td className="px-5 py-3 whitespace-nowrap">
        {formatearFecha(proyecto.fechaInicio)}
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          a {formatearFecha(proyecto.fechaFinPlaneada)}
        </span>
        {atrasado ? (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            <IconAlert className="h-3 w-3" />
            atrasado
          </span>
        ) : null}
      </td>
      <td className="px-5 py-3">
        <BarraAvance
          porcentaje={avance.porcentaje}
          completadas={avance.completadas}
          total={avance.total}
        />
        {avance.vencidas > 0 ? (
          <span className="mt-1 block text-xs font-medium text-red-700 dark:text-red-400">
            {avance.vencidas} {avance.vencidas === 1 ? "vencida" : "vencidas"}
          </span>
        ) : null}
      </td>
      <td className="px-5 py-3">
        <div className="flex flex-col items-start gap-1">
          <EstadoBadge estado={proyecto.estado} />
          <VeredictoBadge veredicto={proyecto.veredicto} />
        </div>
      </td>
    </tr>
  );
}

function Resumen({
  titulo,
  valor,
  tono,
}: {
  titulo: string;
  valor: string;
  tono?: "rojo" | "ambar";
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
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>
        {valor}
      </p>
    </div>
  );
}
