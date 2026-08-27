"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { IconFilter, IconSearch } from "../icons";

const card =
  "rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";
const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";

export type FilaCliente = {
  recordId: string;
  id: string;
  nombre: string;
  nit: string | null;
  ciudad: string | null;
  departamento: string | null;
  activo: boolean;
  contactos: number;
  visitas: number;
  ultimaVisita: string | null;
  seguimientoAtrasado: boolean;
};

export function ListaClientes({ filas }: { filas: FilaCliente[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("activos");
  const [departamento, setDepartamento] = useState("");

  const departamentos = useMemo(() => {
    const valores = new Set<string>();
    for (const fila of filas) {
      if (fila.departamento) valores.add(fila.departamento);
    }
    return [...valores].sort((a, b) => a.localeCompare(b, "es"));
  }, [filas]);

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return filas.filter((fila) => {
      const texto =
        `${fila.nombre} ${fila.id} ${fila.nit ?? ""} ${fila.ciudad ?? ""}`.toLowerCase();

      if (termino && !texto.includes(termino)) return false;
      if (estado === "activos" && !fila.activo) return false;
      if (estado === "inactivos" && fila.activo) return false;
      if (departamento && fila.departamento !== departamento) return false;

      return true;
    });
  }, [filas, busqueda, estado, departamento]);

  const resumen = useMemo(
    () => ({
      activos: filas.filter((f) => f.activo).length,
      sinVisitas: filas.filter((f) => f.activo && f.visitas === 0).length,
      atrasados: filas.filter((f) => f.seguimientoAtrasado).length,
    }),
    [filas],
  );

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {filas.length} en la base · {resumen.activos} activos ·{" "}
            {resumen.sinVisitas} activos sin visitas registradas ·{" "}
            {resumen.atrasados} con seguimiento atrasado
          </p>
        </div>
      </div>

      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <label htmlFor="buscar-cliente" className="sr-only">
              Buscar clientes
            </label>
            <input
              id="buscar-cliente"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, código, NIT o ciudad…"
              className={`${input} pl-9`}
            />
          </div>

          <div className="flex items-center gap-2">
            <IconFilter className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <label htmlFor="filtro-estado" className="sr-only">
              Estado del cliente
            </label>
            <select
              id="filtro-estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className={`${input} w-auto cursor-pointer`}
            >
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>

            <label htmlFor="filtro-departamento" className="sr-only">
              Departamento
            </label>
            <select
              id="filtro-departamento"
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
              className={`${input} w-auto cursor-pointer`}
            >
              <option value="">Todo departamento</option>
              {departamentos.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <p className="mt-8 pb-4 text-center text-sm text-slate-600 dark:text-slate-400">
            {filas.length === 0
              ? "Todavía no hay clientes en Sirius Clients Core."
              : "Ningún cliente coincide con estos filtros."}
          </p>
        ) : (
          <div className="-mx-5 mt-4 overflow-x-auto">
            <table className="w-full min-w-[58rem] text-sm">
              <thead>
                <tr className="border-y border-slate-200 text-left text-xs tracking-wide text-slate-600 uppercase dark:border-white/10 dark:text-slate-400">
                  {[
                    "Cliente",
                    "NIT",
                    "Ubicación",
                    "Contactos",
                    "Visitas",
                    "Última visita",
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
                {filtradas.map((fila) => (
                  <tr
                    key={fila.recordId}
                    className="transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/clientes/${fila.recordId}`}
                        className="rounded font-semibold text-blue-800 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-blue-300"
                      >
                        {fila.nombre}
                      </Link>
                      <span className="block text-xs text-slate-500 tabular-nums dark:text-slate-500">
                        {fila.id || "sin código"}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap tabular-nums">
                      {fila.nit ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {fila.ciudad ?? "—"}
                      {fila.departamento ? (
                        <span className="block text-xs text-slate-500 dark:text-slate-500">
                          {fila.departamento}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{fila.contactos}</td>
                    <td className="px-5 py-3 tabular-nums">{fila.visitas}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {formatearFecha(fila.ultimaVisita)}
                      {fila.seguimientoAtrasado ? (
                        <span className="ml-2 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-500/15 dark:text-red-300">
                          atrasado
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <Estado activo={fila.activo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function Estado({ activo }: { activo: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
        activo
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
      }`}
    >
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** Las fechas llegan como YYYY-MM-DD; se formatean sin pasar por Date. */
export function formatearFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return fecha;
  return `${dia} ${MESES[mes - 1]} ${anio}`;
}
