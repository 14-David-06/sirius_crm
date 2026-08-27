"use client";

import { useState } from "react";

import {
  actividades,
  casos,
  embudo,
  equipo,
  kpis,
  pipeline,
  seguimientos,
  tareas as tareasIniciales,
  topClientes,
  ventasMensuales,
  type Kpi,
} from "./data";
import {
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconDots,
  IconFilter,
  IconMail,
  IconNote,
  IconPhone,
  IconRoute,
} from "./icons";

const card =
  "rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";

/* ------------------------------- KPIs ---------------------------------- */

export function FilaKpis() {
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

function TarjetaKpi({ kpi }: { kpi: Kpi }) {
  const positivo = kpi.delta >= 0;
  // En "Casos abiertos" bajar es bueno: el color sigue el significado, no el signo.
  const bueno = kpi.id === "casos" ? !positivo : positivo;

  return (
    <article className={`${card} p-5`}>
      <p className="text-sm text-slate-600 dark:text-slate-400">{kpi.titulo}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {kpi.valor}
        </p>
        <Sparkline serie={kpi.serie} positivo={bueno} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${
            bueno
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300"
          }`}
        >
          {positivo ? (
            <IconArrowUp className="h-3 w-3" />
          ) : (
            <IconArrowDown className="h-3 w-3" />
          )}
          {Math.abs(kpi.delta).toFixed(1)} %
        </span>
        <span className="text-slate-600 dark:text-slate-400">
          {kpi.detalle}
        </span>
      </div>
    </article>
  );
}

function Sparkline({
  serie,
  positivo,
}: {
  serie: number[];
  positivo: boolean;
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
          positivo
            ? "stroke-emerald-500"
            : "stroke-red-500 dark:stroke-red-400"
        }
      />
    </svg>
  );
}

/* ------------------------------ Pipeline -------------------------------- */

export function Pipeline() {
  return (
    <section aria-labelledby="pipeline-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="pipeline-titulo"
        titulo="Pipeline comercial"
        detalle="38 oportunidades · $1.120 M"
        accion="Ver tablero"
      />

      <div className="-mx-5 mt-4 overflow-x-auto px-5 pb-2">
        <div className="flex min-w-max gap-4">
          {pipeline.map((etapa) => (
            <div key={etapa.id} className="w-64 shrink-0">
              <div className="flex items-center justify-between gap-2 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 rounded-full ${etapa.color}`}
                  />
                  <span className="text-sm font-semibold">{etapa.nombre}</span>
                </div>
                <span className="text-xs text-slate-600 tabular-nums dark:text-slate-400">
                  {etapa.monto}
                </span>
              </div>

              <ul className="flex flex-col gap-2">
                {etapa.oportunidades.map((oportunidad) => (
                  <li key={oportunidad.id}>
                    <article
                      tabIndex={0}
                      className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors duration-200 hover:border-blue-400 hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:border-white/10 dark:bg-white/5 dark:hover:border-blue-400/60 dark:hover:bg-white/10"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {oportunidad.cliente}
                        </p>
                        <span
                          aria-hidden="true"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200"
                        >
                          {oportunidad.responsable}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {oportunidad.producto}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold tabular-nums">
                          {oportunidad.monto}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">
                          {oportunidad.probabilidad} % · {oportunidad.dias} d
                        </span>
                      </div>
                      <div
                        className="mt-2 h-1 rounded-full bg-slate-200 dark:bg-white/10"
                        role="presentation"
                      >
                        <div
                          className="h-1 rounded-full bg-blue-700 dark:bg-blue-400"
                          style={{ width: `${oportunidad.probabilidad}%` }}
                        />
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Gráficos ------------------------------- */

export function GraficoVentas() {
  const max = Math.max(...ventasMensuales.map((p) => Math.max(p.ventas, p.meta)));

  return (
    <section aria-labelledby="ventas-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="ventas-titulo"
        titulo="Ventas vs. meta"
        detalle="Últimos 12 meses · millones COP"
        accion="Exportar"
      />

      <div className="mt-6 flex items-end gap-1.5 sm:gap-2.5">
        {ventasMensuales.map((punto) => {
          const alto = (punto.ventas / max) * 100;
          const altoMeta = (punto.meta / max) * 100;
          const cumple = punto.ventas >= punto.meta;

          return (
            <div
              key={punto.mes}
              className="group flex flex-1 flex-col items-center gap-2"
            >
              <div className="relative flex h-40 w-full items-end justify-center">
                <div
                  aria-hidden="true"
                  className="absolute right-0 left-0 border-t border-dashed border-slate-400 dark:border-slate-500"
                  style={{ bottom: `${altoMeta}%` }}
                />
                <div
                  className={`w-full max-w-8 rounded-t transition-colors duration-200 ${
                    cumple
                      ? "bg-blue-700 group-hover:bg-blue-600 dark:bg-blue-500 dark:group-hover:bg-blue-400"
                      : "bg-slate-300 group-hover:bg-slate-400 dark:bg-slate-600 dark:group-hover:bg-slate-500"
                  }`}
                  style={{ height: `${alto}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">
                {punto.mes}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
        <Leyenda color="bg-blue-700 dark:bg-blue-500" texto="Cumple meta" />
        <Leyenda color="bg-slate-300 dark:bg-slate-600" texto="Bajo meta" />
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-0 w-4 border-t border-dashed border-slate-400 dark:border-slate-500"
          />
          Meta mensual
        </span>
      </div>

      {/* Alternativa accesible al gráfico */}
      <table className="sr-only">
        <caption>Ventas mensuales contra la meta, en millones de pesos</caption>
        <thead>
          <tr>
            <th scope="col">Mes</th>
            <th scope="col">Ventas</th>
            <th scope="col">Meta</th>
          </tr>
        </thead>
        <tbody>
          {ventasMensuales.map((punto) => (
            <tr key={punto.mes}>
              <th scope="row">{punto.mes}</th>
              <td>{punto.ventas}</td>
              <td>{punto.meta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Embudo() {
  const maximo = embudo[0].cantidad;

  return (
    <section aria-labelledby="embudo-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="embudo-titulo"
        titulo="Embudo de conversión"
        detalle="Trimestre actual"
      />

      <ul className="mt-5 flex flex-col gap-3">
        {embudo.map((paso, indice) => {
          const ancho = (paso.cantidad / maximo) * 100;
          const anterior = indice === 0 ? null : embudo[indice - 1].cantidad;
          const tasa = anterior
            ? Math.round((paso.cantidad / anterior) * 100)
            : 100;

          return (
            <li key={paso.etapa}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{paso.etapa}</span>
                <span className="text-slate-600 tabular-nums dark:text-slate-400">
                  {paso.cantidad}
                  {indice > 0 ? ` · ${tasa} %` : ""}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className="h-2.5 rounded-full bg-blue-700 dark:bg-blue-500"
                  style={{ width: `${ancho}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------- Tabla de seguimientos ------------------------ */

const colorEstado: Record<string, string> = {
  "A tiempo":
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  "En riesgo":
    "bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  Vencido: "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

export function TablaSeguimientos() {
  return (
    <section aria-labelledby="seguimientos-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="seguimientos-titulo"
        titulo="Próximos seguimientos"
        detalle="Visitas y compromisos pactados"
        accion="Filtrar"
        Icono={IconFilter}
      />

      <div className="-mx-5 mt-4 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-y border-slate-200 text-left text-xs tracking-wide text-slate-600 uppercase dark:border-white/10 dark:text-slate-400">
              <th scope="col" className="px-5 py-2.5 font-semibold">
                ID
              </th>
              <th scope="col" className="px-5 py-2.5 font-semibold">
                Cliente
              </th>
              <th scope="col" className="px-5 py-2.5 font-semibold">
                Contacto
              </th>
              <th scope="col" className="px-5 py-2.5 font-semibold">
                Tipo
              </th>
              <th scope="col" className="px-5 py-2.5 font-semibold">
                Responsable
              </th>
              <th scope="col" className="px-5 py-2.5 font-semibold">
                Fecha
              </th>
              <th scope="col" className="px-5 py-2.5 font-semibold">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {seguimientos.map((fila) => (
              <tr
                key={fila.id}
                className="cursor-pointer transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                  {fila.id}
                </td>
                <td className="px-5 py-3 font-medium">{fila.cliente}</td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                  {fila.contacto}
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                  {fila.tipo}
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                  {fila.responsable}
                </td>
                <td className="px-5 py-3 whitespace-nowrap tabular-nums">
                  {fila.fecha}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colorEstado[fila.estado]}`}
                  >
                    {fila.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* -------------------------------- Tareas -------------------------------- */

const colorPrioridad: Record<string, string> = {
  alta: "bg-red-500",
  media: "bg-amber-500",
  baja: "bg-slate-400",
};

export function Tareas() {
  const [tareas, setTareas] = useState(tareasIniciales);
  const pendientes = tareas.filter((t) => !t.hecha).length;

  function alternar(id: string) {
    setTareas((previas) =>
      previas.map((tarea) =>
        tarea.id === id ? { ...tarea, hecha: !tarea.hecha } : tarea,
      ),
    );
  }

  return (
    <section aria-labelledby="tareas-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="tareas-titulo"
        titulo="Mis tareas de hoy"
        detalle={`${pendientes} pendientes`}
        accion="Ver todas"
      />

      <ul className="mt-4 flex flex-col gap-1">
        {tareas.map((tarea) => (
          <li key={tarea.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-white/5">
              <input
                type="checkbox"
                checked={tarea.hecha}
                onChange={() => alternar(tarea.id)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-blue-700 dark:accent-blue-500"
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm ${
                    tarea.hecha
                      ? "text-slate-500 line-through dark:text-slate-500"
                      : "font-medium"
                  }`}
                >
                  {tarea.titulo}
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${colorPrioridad[tarea.prioridad]}`}
                  />
                  <span className="sr-only">
                    Prioridad {tarea.prioridad}.
                  </span>
                  {tarea.cliente} · {tarea.hora}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ Actividad ------------------------------- */

const iconoActividad = {
  llamada: IconPhone,
  correo: IconMail,
  visita: IconRoute,
  nota: IconNote,
} as const;

export function Actividad() {
  return (
    <section aria-labelledby="actividad-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="actividad-titulo"
        titulo="Actividad reciente"
        detalle="Equipo comercial"
      />

      <ol className="mt-4 flex flex-col">
        {actividades.map((item, indice) => {
          const Icono = iconoActividad[item.tipo];
          const ultimo = indice === actividades.length - 1;

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
                  {item.cliente} · {item.autor} · {item.cuando}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* -------------------------------- Casos --------------------------------- */

const colorSla: Record<string, string> = {
  "Dentro de SLA":
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  "Por vencer":
    "bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  Vencido: "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

export function Casos() {
  return (
    <section aria-labelledby="casos-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="casos-titulo"
        titulo="Casos por atender"
        detalle="17 abiertos · 4 fuera de SLA"
        accion="Ver todos"
      />

      <ul className="mt-4 flex flex-col gap-2">
        {casos.map((caso) => (
          <li key={caso.id}>
            <article
              tabIndex={0}
              className="cursor-pointer rounded-lg border border-slate-200 p-3 transition-colors duration-200 hover:border-blue-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:border-white/10 dark:hover:border-blue-400/60 dark:hover:bg-white/5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">{caso.asunto}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${colorSla[caso.sla]}`}
                >
                  {caso.sla}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {caso.cliente} · {caso.tipo} · {caso.dias} d abierto
              </p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------- Clientes y equipo -------------------------- */

export function TopClientes() {
  return (
    <section aria-labelledby="clientes-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="clientes-titulo"
        titulo="Clientes por facturación"
        detalle="Año en curso"
      />

      <ul className="mt-4 flex flex-col gap-3">
        {topClientes.map((cliente) => (
          <li key={cliente.nombre}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">
                {cliente.nombre}
              </span>
              <span className="shrink-0 tabular-nums">{cliente.monto}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className="h-1.5 rounded-full bg-amber-500"
                  style={{ width: `${cliente.porcentaje}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-xs text-slate-600 dark:text-slate-400">
                {cliente.sector}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Equipo() {
  return (
    <section aria-labelledby="equipo-titulo" className={`${card} p-5`}>
      <EncabezadoPanel
        id="equipo-titulo"
        titulo="Desempeño del equipo"
        detalle="Cumplimiento de cuota"
      />

      <ul className="mt-4 flex flex-col gap-4">
        {equipo.map((persona) => (
          <li key={persona.iniciales} className="flex items-center gap-3">
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
                  {persona.cerradas} cerradas · {persona.cuota} %
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className={`h-1.5 rounded-full ${
                    persona.cuota >= 70 ? "bg-emerald-500" : "bg-blue-700 dark:bg-blue-500"
                  }`}
                  style={{ width: `${persona.cuota}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------- Auxiliares ----------------------------- */

function EncabezadoPanel({
  id,
  titulo,
  detalle,
  accion,
  Icono = IconDots,
}: {
  id: string;
  titulo: string;
  detalle: string;
  accion?: string;
  Icono?: (props: { className?: string }) => React.ReactElement;
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
      {accion ? (
        <button
          type="button"
          title="Próximamente"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-300 dark:hover:bg-white/10"
        >
          <Icono className="h-4 w-4" />
          {accion}
        </button>
      ) : null}
    </div>
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      {texto}
    </span>
  );
}

export function BarraFiltros() {
  const rangos = ["Hoy", "7 días", "30 días", "Trimestre"];
  const [activo, setActivo] = useState("30 días");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label="Rango de tiempo"
        className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-white/10 dark:bg-slate-900"
      >
        {rangos.map((rango) => (
          <button
            key={rango}
            type="button"
            onClick={() => setActivo(rango)}
            aria-pressed={activo === rango}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
              activo === rango
                ? "bg-blue-700 text-white dark:bg-blue-600"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            {rango}
          </button>
        ))}
      </div>

      <button
        type="button"
        title="Próximamente"
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/10"
      >
        <IconFilter className="h-4 w-4" />
        Filtros
      </button>

      <button
        type="button"
        title="Próximamente"
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/10"
      >
        <IconCalendar className="h-4 w-4" />
        Ago 2026
      </button>
    </div>
  );
}
