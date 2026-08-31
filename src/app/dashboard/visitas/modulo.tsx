"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ClienteCore } from "@/lib/clientes";
import type { Caso } from "@/lib/casos";
import type { Visita } from "@/lib/crm";
import type { Producto } from "@/lib/productos";
import { motivoSinAcceso, type Permisos } from "@/lib/permisos";
import { RESULTADOS_VISITA, TIPOS_VISITA } from "@/lib/crm-comun";
import {
  IconCalendar,
  IconFilter,
  IconPlus,
  IconRoute,
  IconSearch,
} from "../icons";
import { FormularioVisita } from "./formulario-visita";

const card =
  "tarjeta3d rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";
const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Props = {
  visitas: Visita[];
  casos: Caso[];
  clientes: ClienteCore[];
  productos: Producto[];
  personal: { nombre: string; rol: string | null; idEmpleado: string }[];
  sesion: { idEmpleado: string; nombre: string };
  hoy: string;
  transcripcionDisponible: boolean;
  permisos: Permisos;
};

export function ModuloVisitas({
  visitas,
  casos,
  clientes,
  productos,
  personal,
  sesion,
  hoy,
  transcripcionDisponible,
  permisos,
}: Props) {
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [formularioAbierto, setFormularioAbierto] = useState(false);

  const pendientes = visitas.filter((v) => v.fechaSeguimiento);
  const atrasadas = pendientes.filter(
    (v) => v.estadoSeguimiento === "Atrasado",
  ).length;
  const deHoy = pendientes.filter((v) => v.estadoSeguimiento === "Hoy").length;

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Visitas
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Cada visita, llamada o reunión comercial, con su compromiso de
            seguimiento.
          </p>
        </div>

        {permisos.crear ? (
          <button
            type="button"
            onClick={() => setFormularioAbierto(true)}
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <IconPlus className="h-4 w-4" />
            Registrar visita
          </button>
        ) : null}
      </div>

      {permisos.verTodo ? null : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {motivoSinAcceso(permisos)}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Resumen titulo="Visitas registradas" valor={visitas.length} />
        <Resumen titulo="Seguimientos abiertos" valor={pendientes.length} />
        <Resumen titulo="Atrasados" valor={atrasadas} tono="rojo" />
        <Resumen titulo="Para hoy" valor={deHoy} tono="ambar" />
      </div>

      <div
        role="tablist"
        aria-label="Vista de visitas"
        className="flex w-fit rounded-lg border border-slate-200 bg-white p-0.5 dark:border-white/10 dark:bg-slate-900"
      >
        <Pestana
          activa={vista === "lista"}
          onClick={() => setVista("lista")}
          icono={<IconRoute className="h-4 w-4" />}
          texto="Lista"
        />
        <Pestana
          activa={vista === "calendario"}
          onClick={() => setVista("calendario")}
          icono={<IconCalendar className="h-4 w-4" />}
          texto="Calendario de pendientes"
        />
      </div>

      {vista === "lista" ? (
        <ListaVisitas visitas={visitas} />
      ) : (
        <Calendario visitas={visitas} casos={casos} hoy={hoy} />
      )}

      {formularioAbierto ? (
        <FormularioVisita
          clientes={clientes}
          productos={productos}
          personal={personal}
          visitas={visitas}
          sesion={sesion}
          hoy={hoy}
          transcripcionDisponible={transcripcionDisponible}
          onCerrar={() => setFormularioAbierto(false)}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------- Resumen -------------------------------- */

function Resumen({
  titulo,
  valor,
  tono = "neutro",
}: {
  titulo: string;
  valor: number;
  tono?: "neutro" | "rojo" | "ambar";
}) {
  const color =
    tono === "rojo"
      ? "text-red-700 dark:text-red-400"
      : tono === "ambar"
        ? "text-amber-700 dark:text-amber-400"
        : "";

  return (
    <article className={`${card} p-5`}>
      <p className="text-sm text-slate-600 dark:text-slate-400">{titulo}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${color}`}>{valor}</p>
    </article>
  );
}

/* ------------------------------ Lista/tabla ------------------------------ */

const colorResultado: Record<string, string> = {
  Interesado:
    "bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  "Cotización enviada":
    "bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300",
  "Venta cerrada":
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  "Seguimiento pendiente":
    "bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  "Sin interés por ahora":
    "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
};

const colorEstadoSeguimiento: Record<string, string> = {
  Atrasado: "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  Hoy: "bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  Programado:
    "bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
};

function ListaVisitas({ visitas }: { visitas: Visita[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState("");
  const [resultado, setResultado] = useState("");

  const filtradas = visitas.filter((visita) => {
    const texto = `${visita.cliente} ${visita.responsable ?? ""} ${
      visita.objetivo ?? ""
    } ${visita.id}`.toLowerCase();
    return (
      (!busqueda || texto.includes(busqueda.toLowerCase())) &&
      (!tipo || visita.tipo === tipo) &&
      (!resultado || visita.resultado === resultado)
    );
  });

  return (
    <section className={`${card} p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          <label htmlFor="buscar-visita" className="sr-only">
            Buscar visitas
          </label>
          <input
            id="buscar-visita"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, responsable u objetivo…"
            className={`${input} pl-9`}
          />
        </div>

        <div className="flex items-center gap-2">
          <IconFilter className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <label htmlFor="filtro-tipo" className="sr-only">
            Tipo de visita
          </label>
          <select
            id="filtro-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={`${input} w-auto cursor-pointer`}
          >
            <option value="">Todo tipo</option>
            {TIPOS_VISITA.map((valor) => (
              <option key={valor} value={valor}>
                {valor}
              </option>
            ))}
          </select>

          <label htmlFor="filtro-resultado" className="sr-only">
            Resultado
          </label>
          <select
            id="filtro-resultado"
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            className={`${input} w-auto cursor-pointer`}
          >
            <option value="">Todo resultado</option>
            {RESULTADOS_VISITA.map((valor) => (
              <option key={valor} value={valor}>
                {valor}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <VacioLista hayVisitas={visitas.length > 0} />
      ) : (
        <div className="-mx-5 mt-4 overflow-x-auto">
          <table className="w-full min-w-[62rem] text-sm">
            <thead>
              <tr className="border-y border-slate-200 text-left text-xs tracking-wide text-slate-600 uppercase dark:border-white/10 dark:text-slate-400">
                {[
                  "ID",
                  "Fecha",
                  "Cliente",
                  "Tipo",
                  "Objetivo",
                  "Resultado",
                  "Próxima acción",
                  "Seguimiento",
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
              {filtradas.map((visita) => (
                <tr
                  key={visita.recordId}
                  className="transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {visita.id}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap tabular-nums">
                    {formatearFecha(visita.fecha)}
                  </td>
                  <td className="px-5 py-3 font-medium">
                    {visita.cliente}
                    <span className="block text-xs font-normal text-slate-600 dark:text-slate-400">
                      {visita.responsable ?? "Sin responsable"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                    {visita.tipo ?? "—"}
                  </td>
                  <td className="max-w-72 px-5 py-3 text-slate-600 dark:text-slate-400">
                    <span className="line-clamp-2">
                      {visita.objetivo ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {visita.resultado ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                          colorResultado[visita.resultado] ?? ""
                        }`}
                      >
                        {visita.resultado}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-64 px-5 py-3 text-slate-600 dark:text-slate-400">
                    <span className="line-clamp-2">
                      {visita.proximaAccion ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {visita.fechaSeguimiento ? (
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">
                          {formatearFecha(visita.fechaSeguimiento)}
                        </span>
                        {visita.estadoSeguimiento ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              colorEstadoSeguimiento[visita.estadoSeguimiento]
                            }`}
                          >
                            {visita.estadoSeguimiento}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-slate-500">Sin pendiente</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function VacioLista({ hayVisitas }: { hayVisitas: boolean }) {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center dark:border-white/15">
      <p className="text-sm font-medium">
        {hayVisitas
          ? "Ninguna visita coincide con el filtro."
          : "Todavía no hay visitas registradas."}
      </p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {hayVisitas
          ? "Ajusta la búsqueda o limpia los filtros."
          : "Usa “Registrar visita” para cargar la primera. Se guarda directo en la base Sirius CRM."}
      </p>
    </div>
  );
}

/* ------------------------------- Calendario ------------------------------ */

type Pendiente = {
  id: string;
  recordId: string;
  fecha: string;
  cliente: string;
  titulo: string;
  responsable: string | null;
  origen: "visita" | "caso";
  estado: string | null;
  observaciones: string | null;
};

function Calendario({
  visitas,
  casos,
  hoy,
}: {
  visitas: Visita[];
  casos: Caso[];
  hoy: string;
}) {
  const [ancla, setAncla] = useState(() => hoy.slice(0, 7)); // YYYY-MM
  const [diaElegido, setDiaElegido] = useState<string | null>(hoy);

  const pendientes = useMemo<Pendiente[]>(() => {
    const deVisitas: Pendiente[] = visitas
      .filter((v) => v.fechaSeguimiento)
      .map((v) => ({
        id: v.id,
        recordId: v.recordId,
        fecha: v.fechaSeguimiento as string,
        cliente: v.cliente,
        titulo: v.proximaAccion ?? "Seguimiento de visita",
        responsable: v.responsable,
        origen: "visita",
        estado: v.estadoSeguimiento,
        observaciones: v.observaciones,
      }));

    const deCasos: Pendiente[] = casos.map((c) => ({
      id: c.id,
      recordId: c.recordId,
      fecha: c.fechaLimite as string,
      cliente: c.cliente,
      titulo: c.descripcion ?? c.tipo ?? "Caso por resolver",
      responsable: c.responsable,
      origen: "caso",
      estado: c.estado,
      observaciones: null,
    }));

    return [...deVisitas, ...deCasos].sort((a, b) =>
      a.fecha.localeCompare(b.fecha),
    );
  }, [visitas, casos]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Pendiente[]>();
    for (const pendiente of pendientes) {
      const lista = mapa.get(pendiente.fecha) ?? [];
      lista.push(pendiente);
      mapa.set(pendiente.fecha, lista);
    }
    return mapa;
  }, [pendientes]);

  const [anio, mes] = ancla.split("-").map(Number);
  const celdas = construirMes(anio, mes);
  const delDia = diaElegido ? (porDia.get(diaElegido) ?? []) : [];

  function moverMes(delta: number) {
    const fecha = new Date(Date.UTC(anio, mes - 1 + delta, 1));
    setAncla(
      `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <section className={`${card} p-5 xl:col-span-2`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              {MESES[mes - 1]} {anio}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Compromisos de seguimiento y fechas límite de casos
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => moverMes(-1)}
              className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => {
                setAncla(hoy.slice(0, 7));
                setDiaElegido(hoy);
              }}
              className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => moverMes(1)}
              className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
            >
              Siguiente
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-600 uppercase dark:text-slate-400">
          {DIAS.map((dia) => (
            <span key={dia}>{dia}</span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {celdas.map((celda, indice) => {
            if (!celda) {
              return <span key={`vacio-${indice}`} className="min-h-24" />;
            }

            const items = porDia.get(celda) ?? [];
            const esHoy = celda === hoy;
            const elegido = celda === diaElegido;

            return (
              <button
                key={celda}
                type="button"
                onClick={() => setDiaElegido(celda)}
                aria-pressed={elegido}
                className={`min-h-24 cursor-pointer rounded-lg border p-1.5 text-left transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                  elegido
                    ? "border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10"
                    : "border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                    esHoy
                      ? "bg-blue-700 text-white dark:bg-blue-500"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {Number(celda.slice(8, 10))}
                </span>

                <span className="mt-1 flex flex-col gap-1">
                  {items.slice(0, 2).map((item) => (
                    <span
                      key={`${item.origen}-${item.recordId}`}
                      className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${colorPendiente(item, hoy)}`}
                    >
                      {item.cliente}
                    </span>
                  ))}
                  {items.length > 2 ? (
                    <span className="px-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                      +{items.length - 2} más
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
          <Punto clase="bg-red-500" texto="Atrasado" />
          <Punto clase="bg-amber-500" texto="Hoy" />
          <Punto clase="bg-blue-600" texto="Programado" />
          <Punto clase="bg-violet-500" texto="Caso con fecha límite" />
        </div>
      </section>

      <PanelDia fecha={diaElegido} pendientes={delDia} hoy={hoy} />
    </div>
  );
}

function PanelDia({
  fecha,
  pendientes,
  hoy,
}: {
  fecha: string | null;
  pendientes: Pendiente[];
  hoy: string;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function actuar(pendiente: Pendiente, accion: "cumplido" | "reprogramar") {
    if (pendiente.origen !== "visita") return;

    let fechaNueva: string | null = null;
    if (accion === "reprogramar") {
      fechaNueva = window.prompt(
        "Nueva fecha de seguimiento (AAAA-MM-DD)",
        pendiente.fecha,
      );
      if (!fechaNueva) return;
    }

    setOcupado(pendiente.recordId);
    setError(null);

    const respuesta = await fetch(
      `/api/visitas/${pendiente.recordId}/seguimiento`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          accion === "reprogramar"
            ? { accion, fecha: fechaNueva }
            : {
                accion,
                nota: pendiente.titulo,
                observaciones: pendiente.observaciones,
              },
        ),
      },
    );

    setOcupado(null);

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos actualizar el seguimiento."));
      return;
    }

    router.refresh();
  }

  return (
    <section className={`${card} p-5`}>
      <h2 className="text-base font-semibold tracking-tight">
        {fecha ? formatearFechaLarga(fecha) : "Selecciona un día"}
      </h2>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
        {pendientes.length === 0
          ? "Sin pendientes para este día"
          : `${pendientes.length} pendiente${pendientes.length === 1 ? "" : "s"}`}
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <ul className="mt-4 flex flex-col gap-3">
        {pendientes.map((pendiente) => (
          <li
            key={`${pendiente.origen}-${pendiente.recordId}`}
            className="rounded-lg border border-slate-200 p-3 dark:border-white/10"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{pendiente.cliente}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${colorPendiente(pendiente, hoy)}`}
              >
                {pendiente.origen === "caso"
                  ? "Caso"
                  : (pendiente.estado ?? "Pendiente")}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              {pendiente.titulo}
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {pendiente.id} · {pendiente.responsable ?? "sin responsable"}
            </p>

            {pendiente.origen === "visita" ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={ocupado === pendiente.recordId}
                  onClick={() => actuar(pendiente, "cumplido")}
                  className="cursor-pointer rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  Marcar cumplido
                </button>
                <button
                  type="button"
                  disabled={ocupado === pendiente.recordId}
                  onClick={() => actuar(pendiente, "reprogramar")}
                  className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
                >
                  Reprogramar
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Punto({ clase, texto }: { clase: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${clase}`} />
      {texto}
    </span>
  );
}

function colorPendiente(pendiente: Pendiente, hoy: string): string {
  if (pendiente.origen === "caso") {
    return "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200";
  }
  if (pendiente.fecha < hoy) {
    return "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200";
  }
  if (pendiente.fecha === hoy) {
    return "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200";
  }
  return "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200";
}

/** Devuelve las celdas del mes empezando en lunes; null = celda vacía. */
function construirMes(anio: number, mes: number): (string | null)[] {
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  const diaSemana = (primero.getUTCDay() + 6) % 7; // 0 = lunes
  const dias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();

  const celdas: (string | null)[] = Array.from({ length: diaSemana }, () => null);
  for (let dia = 1; dia <= dias; dia += 1) {
    celdas.push(
      `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
    );
  }
  return celdas;
}

/* ------------------------------- Auxiliares ------------------------------ */

function Pestana({
  activa,
  onClick,
  icono,
  texto,
}: {
  activa: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  texto: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
        activa
          ? "bg-blue-700 text-white dark:bg-blue-600"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
      }`}
    >
      {icono}
      {texto}
    </button>
  );
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio.slice(2)}`;
}

function formatearFechaLarga(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}
