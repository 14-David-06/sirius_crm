import Link from "next/link";

import type { Caso } from "@/lib/casos";
import { formatearFecha } from "@/lib/fechas";
import type {
  ClienteActivo,
  FilaSeguimiento,
  ItemActividad,
  KpiInicio,
  PersonaEquipo,
  PuntoMes,
  ResultadoVisitas,
} from "@/lib/inicio";
import {
  IconArrowDown,
  IconArrowUp,
  IconMail,
  IconPhone,
  IconRoute,
} from "./icons";

const card =
  "rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";

/* ------------------------------- KPIs ---------------------------------- */

export function FilaKpis({ kpis }: { kpis: KpiInicio[] }) {
  return (
    <section aria-labelledby="kpis-titulo">
      <h2 id="kpis-titulo" className="sr-only">
        Indicadores principales
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <TarjetaKpi key={kpi.id} kpi={kpi} />
        ))}
      </div>
    </section>
  );
}

function TarjetaKpi({ kpi }: { kpi: KpiInicio }) {
  const subio = kpi.delta !== null && kpi.delta >= 0;
  // El color sigue el significado, no el signo: en casos, bajar es bueno.
  const bueno = kpi.bajarEsBueno ? !subio : subio;

  return (
    <article className={`${card} p-5`}>
      <p className="text-sm text-slate-600 dark:text-slate-400">{kpi.titulo}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {kpi.valor}
        </p>
        {kpi.serie.length > 1 ? (
          <Sparkline serie={kpi.serie} tono={kpi.delta === null ? null : bueno} />
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {/* Sin periodo anterior no se inventa una variación. */}
        {kpi.delta === null ? null : (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${
              bueno
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300"
            }`}
          >
            {subio ? (
              <IconArrowUp className="h-3 w-3" />
            ) : (
              <IconArrowDown className="h-3 w-3" />
            )}
            {Math.abs(kpi.delta).toFixed(0)} %
          </span>
        )}
        <span className="text-slate-600 dark:text-slate-400">
          {kpi.detalle}
        </span>
      </div>
    </article>
  );
}

function Sparkline({
  serie,
  tono,
}: {
  serie: number[];
  /** null cuando no hay variación con la que juzgar si va bien o mal. */
  tono: boolean | null;
}) {
  const max = Math.max(...serie);
  const min = Math.min(...serie);
  const rango = max - min || 1;
  const puntos = serie
    .map((valor, indice) => {
      const x = (indice / (serie.length - 1)) * 100;
      const y = 28 - ((valor - min) / rango) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="h-8 w-24 shrink-0"
    >
      <polyline
        points={puntos}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={
          tono === null
            ? "stroke-slate-400 dark:stroke-slate-500"
            : tono
              ? "stroke-emerald-500"
              : "stroke-red-500 dark:stroke-red-400"
        }
      />
    </svg>
  );
}

/* --------------------------- Visitas por mes ---------------------------- */

export function GraficoVisitas({ puntos }: { puntos: PuntoMes[] }) {
  const max = Math.max(...puntos.map((p) => p.visitas), 1);
  const total = puntos.reduce((suma, p) => suma + p.visitas, 0);

  return (
    <section aria-labelledby="visitas-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="visitas-titulo"
        titulo="Visitas por mes"
        detalle="Últimos 12 meses"
        enlace={{ href: "/dashboard/visitas", texto: "Ver visitas" }}
      />

      {total === 0 ? (
        <Vacio texto="Todavía no hay visitas registradas en este periodo." />
      ) : (
        <>
          <div className="mt-6 flex items-end gap-1.5 sm:gap-2.5">
            {puntos.map((punto) => (
              <div
                key={punto.mes}
                className="group flex flex-1 flex-col items-center gap-2"
              >
                <div className="relative flex h-40 w-full items-end justify-center">
                  {punto.visitas > 0 ? (
                    <span className="absolute -top-5 text-[11px] font-semibold text-slate-600 tabular-nums opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-300">
                      {punto.visitas}
                    </span>
                  ) : null}
                  <div
                    className="w-full max-w-8 rounded-t bg-blue-700 transition-colors duration-200 group-hover:bg-blue-600 dark:bg-blue-500 dark:group-hover:bg-blue-400"
                    style={{
                      // Las barras en cero se dejan como una línea visible.
                      height: `${Math.max((punto.visitas / max) * 100, punto.visitas > 0 ? 4 : 1)}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  {punto.etiqueta}
                </span>
              </div>
            ))}
          </div>

          {/* Alternativa accesible al gráfico */}
          <table className="sr-only">
            <caption>Visitas registradas por mes</caption>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col">Visitas</th>
              </tr>
            </thead>
            <tbody>
              {puntos.map((punto) => (
                <tr key={punto.mes}>
                  <th scope="row">{punto.mes}</th>
                  <td>{punto.visitas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

/* -------------------------- Resultado de visitas ------------------------ */

export function ResultadoDeVisitas({
  resultados,
}: {
  resultados: ResultadoVisitas[];
}) {
  const maximo = Math.max(...resultados.map((r) => r.cantidad), 1);
  const total = resultados.reduce((suma, r) => suma + r.cantidad, 0);

  return (
    <section aria-labelledby="resultados-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="resultados-titulo"
        titulo="Resultado de las visitas"
        detalle={
          total === 0 ? "sin datos" : `${total} visitas con resultado anotado`
        }
      />

      {resultados.length === 0 ? (
        <Vacio texto="Ninguna visita tiene resultado anotado todavía." />
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {resultados.map((paso) => (
            <li key={paso.resultado}>
              <div className="flex items-start justify-between gap-2 text-sm">
                <span className="min-w-0 font-medium">{paso.resultado}</span>
                <span className="shrink-0 text-slate-600 tabular-nums dark:text-slate-400">
                  {paso.cantidad} · {Math.round((paso.cantidad / total) * 100)}{" "}
                  %
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className="h-2.5 rounded-full bg-blue-700 dark:bg-blue-500"
                  style={{ width: `${(paso.cantidad / maximo) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------- Tabla de seguimientos ------------------------ */

const colorEstado: Record<string, string> = {
  Programado:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Hoy: "bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  Atrasado: "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

export function TablaSeguimientos({ filas }: { filas: FilaSeguimiento[] }) {
  return (
    <section aria-labelledby="seguimientos-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="seguimientos-titulo"
        titulo="Próximos seguimientos"
        detalle="Compromisos pactados en visitas"
        enlace={{ href: "/dashboard/visitas", texto: "Ver todos" }}
      />

      {filas.length === 0 ? (
        <Vacio texto="No hay compromisos de seguimiento pendientes." />
      ) : (
        <div className="-mx-5 mt-4 overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-y border-slate-200 text-left text-xs tracking-wide text-slate-600 uppercase dark:border-white/10 dark:text-slate-400">
                {["Visita", "Cliente", "Próxima acción", "Responsable", "Fecha", "Estado"].map(
                  (columna) => (
                    <th
                      key={columna}
                      scope="col"
                      className="px-5 py-2.5 font-semibold whitespace-nowrap"
                    >
                      {columna}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filas.map((fila) => (
                <tr
                  key={fila.recordId}
                  className="transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <td className="px-5 py-3 font-mono text-xs whitespace-nowrap text-slate-600 dark:text-slate-400">
                    {fila.id}
                  </td>
                  <td className="px-5 py-3 font-medium">{fila.cliente}</td>
                  <td className="max-w-xs px-5 py-3 text-slate-600 dark:text-slate-400">
                    {fila.accion}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                    {fila.responsable ?? "—"}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap tabular-nums">
                    {formatearFecha(fila.fecha)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${colorEstado[fila.estado]}`}
                    >
                      {fila.estado}
                    </span>
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

/* ------------------------------ Actividad ------------------------------- */

const iconoPorTipo: Record<
  string,
  (props: { className?: string }) => React.ReactElement
> = {
  Presencial: IconRoute,
  Llamada: IconPhone,
  Virtual: IconMail,
};

export function Actividad({ items }: { items: ItemActividad[] }) {
  return (
    <section aria-labelledby="actividad-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="actividad-titulo"
        titulo="Actividad reciente"
        detalle="Últimas visitas del equipo"
      />

      {items.length === 0 ? (
        <Vacio texto="Todavía no hay visitas registradas." />
      ) : (
        <ol className="mt-4 flex flex-col">
          {items.map((item, indice) => {
            const Icono = iconoPorTipo[item.tipo ?? ""] ?? IconRoute;
            const ultimo = indice === items.length - 1;

            return (
              <li key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                    <Icono className="h-4 w-4" />
                  </span>
                  {ultimo ? null : (
                    <span
                      aria-hidden="true"
                      className="my-1 w-px flex-1 bg-slate-200 dark:bg-white/10"
                    />
                  )}
                </div>
                <div className={ultimo ? "pb-0" : "pb-5"}>
                  <p className="text-sm font-medium">{item.titulo}</p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {item.cliente}
                    {item.responsable ? ` · ${item.responsable}` : ""} ·{" "}
                    {formatearFecha(item.fecha)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/* -------------------------------- Casos --------------------------------- */

const colorAlerta: Record<string, string> = {
  "en-plazo":
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  hoy: "bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  vencido: "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  "sin-plazo": "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
};

const textoAlerta: Record<string, string> = {
  "en-plazo": "En plazo",
  hoy: "Vence hoy",
  vencido: "Vencido",
  "sin-plazo": "Sin plazo",
};

export function Casos({
  casos,
  abiertos,
  vencidos,
}: {
  casos: Caso[];
  abiertos: number;
  vencidos: number;
}) {
  return (
    <section aria-labelledby="casos-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="casos-titulo"
        titulo="Casos por atender"
        detalle={
          abiertos === 0
            ? "ninguno sin resolver"
            : `${abiertos} sin resolver · ${vencidos} con plazo vencido`
        }
        enlace={{ href: "/dashboard/casos", texto: "Ver todos" }}
      />

      {casos.length === 0 ? (
        <Vacio texto="No hay casos sin resolver." />
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {casos.map((caso) => (
            <li key={caso.recordId}>
              <Link
                href="/dashboard/casos"
                className="block rounded-lg border border-slate-200 p-3 transition-colors duration-200 hover:border-blue-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:border-white/10 dark:hover:border-blue-400/60 dark:hover:bg-white/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">
                    {caso.descripcion ?? caso.tipo ?? "Caso abierto"}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${colorAlerta[caso.alerta]}`}
                  >
                    {textoAlerta[caso.alerta]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {caso.cliente}
                  {caso.tipo ? ` · ${caso.tipo}` : ""}
                  {caso.diasAbierto !== null
                    ? ` · ${caso.diasAbierto} d abierto`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------- Clientes y equipo -------------------------- */

export function TopClientes({ clientes }: { clientes: ClienteActivo[] }) {
  const maximo = Math.max(...clientes.map((c) => c.visitas), 1);

  return (
    <section aria-labelledby="clientes-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="clientes-titulo"
        titulo="Clientes más visitados"
        detalle="Por visitas registradas"
        enlace={{ href: "/dashboard/clientes", texto: "Ver clientes" }}
      />

      {clientes.length === 0 ? (
        <Vacio texto="Ningún cliente tiene visitas registradas." />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {clientes.map((cliente) => (
            <li key={cliente.recordId}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <Link
                  href={`/dashboard/clientes/${cliente.recordId}`}
                  className="min-w-0 truncate rounded font-medium hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:hover:text-blue-300"
                >
                  {cliente.nombre}
                </Link>
                <span className="shrink-0 tabular-nums">
                  {cliente.visitas}{" "}
                  {cliente.visitas === 1 ? "visita" : "visitas"}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-amber-500"
                    style={{ width: `${(cliente.visitas / maximo) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 truncate text-right text-xs text-slate-600 dark:text-slate-400">
                  {cliente.ciudad ?? "—"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Equipo({ personas }: { personas: PersonaEquipo[] }) {
  const maximo = Math.max(...personas.map((p) => p.visitas), 1);

  return (
    <section aria-labelledby="equipo-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="equipo-titulo"
        titulo="Actividad del equipo"
        detalle="Visitas registradas y casos a cargo"
      />

      {personas.length === 0 ? (
        <Vacio texto="Nadie tiene visitas ni casos registrados." />
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {personas.map((persona) => (
            <li key={persona.nombre} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200"
              >
                {persona.iniciales}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{persona.nombre}</span>
                  <span className="shrink-0 text-xs text-slate-600 tabular-nums dark:text-slate-400">
                    {persona.visitas}{" "}
                    {persona.visitas === 1 ? "visita" : "visitas"}
                    {persona.casosAbiertos > 0
                      ? ` · ${persona.casosAbiertos} ${persona.casosAbiertos === 1 ? "caso" : "casos"}`
                      : ""}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-blue-700 dark:bg-blue-500"
                    style={{ width: `${(persona.visitas / maximo) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------- Auxiliares ----------------------------- */

function EncabezadoPanel({
  id,
  titulo,
  detalle,
  enlace,
}: {
  id: string;
  titulo: string;
  detalle: string;
  /** Solo se ofrece cuando lleva a un módulo que existe. */
  enlace?: { href: string; texto: string };
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 id={id} className="text-base font-semibold tracking-tight">
          {titulo}
        </h2>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
          {detalle}
        </p>
      </div>
      {enlace ? (
        <Link
          href={enlace.href}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-300 dark:hover:bg-white/10"
        >
          {enlace.texto}
        </Link>
      ) : null}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="mt-6 pb-2 text-sm text-slate-600 dark:text-slate-400">
      {texto}
    </p>
  );
}
