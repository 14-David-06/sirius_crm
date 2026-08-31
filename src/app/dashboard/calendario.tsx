"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { EstadoPendiente, Pendiente } from "@/lib/agenda";
import { IconAlert, IconChevronLeft, IconChevronRight } from "./icons";

const card =
  "tarjeta3d rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";

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

/** El calendario arranca en lunes, como la semana laboral. */
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];

const estilosEstado: Record<
  EstadoPendiente,
  { punto: string; texto: string; borde: string; etiqueta: string }
> = {
  atrasado: {
    punto: "bg-red-500",
    texto: "text-red-700 dark:text-red-300",
    borde: "border-l-red-500",
    etiqueta: "Atrasado",
  },
  hoy: {
    punto: "bg-amber-500",
    texto: "text-amber-700 dark:text-amber-300",
    borde: "border-l-amber-500",
    etiqueta: "Hoy",
  },
  proximo: {
    punto: "bg-blue-600 dark:bg-blue-400",
    texto: "text-blue-700 dark:text-blue-300",
    borde: "border-l-blue-600 dark:border-l-blue-400",
    etiqueta: "Programado",
  },
};

function partes(fecha: string): [number, number, number] {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return [anio, mes - 1, dia];
}

function clave(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Suma dias a una fecha YYYY-MM-DD sin pasar por zonas horarias. */
function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = partes(fecha);
  const d = new Date(anio, mes, dia + dias);
  return clave(d.getFullYear(), d.getMonth(), d.getDate());
}

function etiquetaFecha(fecha: string, hoy: string): string {
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, 1)) return "Mañana";
  if (fecha === sumarDias(hoy, -1)) return "Ayer";

  const [anio, mes, dia] = partes(fecha);
  const mismoAnio = anio === Number(hoy.slice(0, 4));
  return `${dia} de ${MESES[mes]}${mismoAnio ? "" : ` de ${anio}`}`;
}

export function CalendarioPendientes({
  pendientes,
  hoy,
  error,
  usuario,
}: {
  pendientes: Pendiente[];
  hoy: string;
  error: boolean;
  usuario: string;
}) {
  const [anioHoy, mesHoy] = partes(hoy);
  const [visible, setVisible] = useState({ anio: anioHoy, mes: mesHoy });
  const [seleccionado, setSeleccionado] = useState(hoy);
  const [soloMios, setSoloMios] = useState(false);

  const visibles = useMemo(
    () =>
      soloMios
        ? pendientes.filter((p) => mismaPersona(p.responsable, usuario))
        : pendientes,
    [pendientes, soloMios, usuario],
  );

  const porFecha = useMemo(() => {
    const mapa = new Map<string, Pendiente[]>();
    for (const pendiente of visibles) {
      const lista = mapa.get(pendiente.fecha);
      if (lista) lista.push(pendiente);
      else mapa.set(pendiente.fecha, [pendiente]);
    }
    return mapa;
  }, [visibles]);

  const resumen = useMemo(() => {
    const finSemana = sumarDias(hoy, 7);
    return {
      atrasados: visibles.filter((p) => p.estado === "atrasado").length,
      hoy: visibles.filter((p) => p.estado === "hoy").length,
      semana: visibles.filter((p) => p.fecha > hoy && p.fecha <= finSemana)
        .length,
    };
  }, [visibles, hoy]);

  const celdas = useMemo(
    () => construirMes(visible.anio, visible.mes),
    [visible],
  );

  const delDia = porFecha.get(seleccionado) ?? [];

  function moverMes(delta: number) {
    setVisible((actual) => {
      const d = new Date(actual.anio, actual.mes + delta, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() };
    });
  }

  function irAHoy() {
    setVisible({ anio: anioHoy, mes: mesHoy });
    setSeleccionado(hoy);
  }

  return (
    <section aria-labelledby="agenda-titulo" className={`${card} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="agenda-titulo"
            className="text-base font-semibold tracking-tight"
          >
            Agenda de pendientes
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {error
              ? "No pudimos leer los compromisos de Airtable."
              : `${resumen.atrasados} atrasados · ${resumen.hoy} para hoy · ${resumen.semana} en los próximos 7 días`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSoloMios((valor) => !valor)}
            aria-pressed={soloMios}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
              soloMios
                ? "border-blue-700 bg-blue-700 text-white dark:border-blue-600 dark:bg-blue-600"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            Solo míos
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => moverMes(-1)}
              aria-label="Mes anterior"
              className="cursor-pointer rounded-lg p-1.5 text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-300 dark:hover:bg-white/10"
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm font-semibold capitalize">
              {MESES[visible.mes]} {visible.anio}
            </span>
            <button
              type="button"
              onClick={() => moverMes(1)}
              aria-label="Mes siguiente"
              className="cursor-pointer rounded-lg p-1.5 text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-300 dark:hover:bg-white/10"
            >
              <IconChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={irAHoy}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/10"
          >
            Hoy
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ------------------------------ Mes ------------------------------ */}
        <div>
          <div className="grid grid-cols-7 gap-1 pb-1">
            {DIAS.map((dia, indice) => (
              <span
                key={`${dia}-${indice}`}
                className="py-1 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-500"
              >
                {dia}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {celdas.map((celda) => {
              const items = porFecha.get(celda.fecha) ?? [];
              const esHoy = celda.fecha === hoy;
              const esSeleccionado = celda.fecha === seleccionado;

              return (
                <button
                  key={celda.fecha}
                  type="button"
                  onClick={() => setSeleccionado(celda.fecha)}
                  aria-pressed={esSeleccionado}
                  aria-label={`${celda.dia} de ${MESES[celda.mes]}: ${items.length} pendientes`}
                  className={`flex h-[4.5rem] cursor-pointer flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                    esSeleccionado
                      ? "border-blue-700 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/15"
                      : "border-transparent hover:bg-slate-50 dark:hover:bg-white/5"
                  } ${celda.delMes ? "" : "opacity-40"}`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums ${
                      esHoy
                        ? "bg-blue-700 font-bold text-white dark:bg-blue-600"
                        : "font-medium text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {celda.dia}
                  </span>

                  {items.length > 0 ? (
                    <span className="flex flex-wrap items-center gap-1">
                      {items.slice(0, 3).map((item) => (
                        <span
                          key={item.id}
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${estilosEstado[item.estado].punto}`}
                        />
                      ))}
                      {items.length > 3 ? (
                        <span className="text-[10px] font-semibold text-slate-600 tabular-nums dark:text-slate-400">
                          +{items.length - 3}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
            <Punto clase={estilosEstado.atrasado.punto} texto="Atrasado" />
            <Punto clase={estilosEstado.hoy.punto} texto="Vence hoy" />
            <Punto clase={estilosEstado.proximo.punto} texto="Programado" />
          </div>
        </div>

        {/* --------------------------- Día elegido -------------------------- */}
        <div className="min-w-0 border-slate-200 lg:border-l lg:pl-5 dark:border-white/10">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {etiquetaFecha(seleccionado, hoy)}
            </h3>
            <span className="text-xs text-slate-600 tabular-nums dark:text-slate-400">
              {delDia.length} {delDia.length === 1 ? "pendiente" : "pendientes"}
            </span>
          </div>

          {error ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-500/10 dark:text-red-300">
              <IconAlert className="h-4 w-4 shrink-0" />
              Revisa la conexión con Airtable y recarga la página.
            </p>
          ) : delDia.length === 0 ? (
            <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">
              Sin compromisos para este día.
            </p>
          ) : (
            <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {delDia.map((pendiente) => {
                const estilo = estilosEstado[pendiente.estado];

                return (
                  <li key={pendiente.id}>
                    <Link
                      href="/dashboard/visitas"
                      className={`block rounded-lg border border-l-4 border-slate-200 bg-slate-50 p-3 transition-colors duration-200 hover:border-blue-400 hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 ${estilo.borde}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {pendiente.cliente}
                        </p>
                        <span
                          className={`shrink-0 text-[10px] font-semibold uppercase ${estilo.texto}`}
                        >
                          {estilo.etiqueta}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                        {pendiente.titulo}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
                        {pendiente.tipo === "seguimiento"
                          ? "Seguimiento de visita"
                          : "Caso abierto"}
                        {pendiente.responsable
                          ? ` · ${pendiente.responsable}`
                          : ""}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Punto({ clase, texto }: { clase: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${clase}`} />
      {texto}
    </span>
  );
}

type Celda = { fecha: string; dia: number; mes: number; delMes: boolean };

/** Rejilla de 6 semanas: rellena con los dias vecinos para no dejar huecos. */
function construirMes(anio: number, mes: number): Celda[] {
  const primero = new Date(anio, mes, 1);
  // getDay() devuelve 0 para domingo; la rejilla empieza en lunes.
  const desplazamiento = (primero.getDay() + 6) % 7;
  const celdas: Celda[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(anio, mes, 1 - desplazamiento + i);
    celdas.push({
      fecha: clave(d.getFullYear(), d.getMonth(), d.getDate()),
      dia: d.getDate(),
      mes: d.getMonth(),
      delMes: d.getMonth() === mes && d.getFullYear() === anio,
    });
  }

  return celdas;
}

/** Ignora mayusculas y tildes: "Jose" y "José" serian la misma persona. */
const colador = new Intl.Collator("es", { sensitivity: "base" });

/**
 * Airtable guarda el nombre escrito a mano, no el id del empleado, y suele
 * abreviar el apellido ("Ana R." por "Ana Rodriguez"). Coincide el nombre y la
 * inicial.
 */
function mismaPersona(responsable: string | null, usuario: string): boolean {
  if (!responsable) return false;

  const a = palabras(responsable);
  const b = palabras(usuario);
  if (a.length === 0 || b.length === 0) return false;
  if (colador.compare(a[0], b[0]) !== 0) return false;
  if (a.length === 1 || b.length === 1) return true;

  return colador.compare(a[1][0], b[1][0]) === 0;
}

function palabras(valor: string): string[] {
  return valor
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}
