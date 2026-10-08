import type { AlertaTarea } from "@/lib/proyectos-comun";
import { IconAlert } from "../icons";

/** Piezas de interfaz que comparten el listado y la ficha de un proyecto. */

export const card =
  "tarjeta3d rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";
export const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";
export const etiqueta = "text-xs font-medium text-slate-700 dark:text-slate-300";
export const botonPrimario =
  "cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500";
export const botonSecundario =
  "cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/10";

export type PersonaOpcion = { nombre: string; idEmpleado: string };
export type ProductoOpcion = {
  codigo: string;
  nombre: string;
  activo: boolean;
};
export type CultivoOpcion = { nombre: string; clientes: string[] };

const TONOS_ESTADO: Record<string, string> = {
  Planeación: "bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  "En ejecución":
    "bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  "En evaluación":
    "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  Finalizado:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Cancelado: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400",
  // Tareas
  Pendiente: "bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  "En curso":
    "bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  Completada:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Cancelada: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400",
};

export function EstadoBadge({ estado }: { estado: string | null }) {
  const clase =
    (estado && TONOS_ESTADO[estado]) ??
    "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${clase}`}
    >
      {estado ?? "Sin estado"}
    </span>
  );
}

const TONOS_VEREDICTO: Record<string, string> = {
  Exitosa:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Parcial: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  "No exitosa": "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  "No concluyente":
    "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
};

export function VeredictoBadge({ veredicto }: { veredicto: string | null }) {
  if (!veredicto) return null;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
        TONOS_VEREDICTO[veredicto] ?? TONOS_VEREDICTO["No concluyente"]
      }`}
    >
      {veredicto}
    </span>
  );
}

export function BarraAvance({
  porcentaje,
  completadas,
  total,
}: {
  porcentaje: number | null;
  completadas: number;
  total: number;
}) {
  if (porcentaje === null) {
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Sin tareas
      </span>
    );
  }
  return (
    <div className="flex min-w-32 items-center gap-2">
      <div
        role="progressbar"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance de tareas"
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
      >
        <div
          className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      <span className="text-xs text-slate-600 tabular-nums dark:text-slate-400">
        {completadas}/{total}
      </span>
    </div>
  );
}

const TONOS_ALERTA: Partial<
  Record<AlertaTarea, { texto: string; clase: string }>
> = {
  vencida: {
    texto: "vencida",
    clase: "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  },
  hoy: {
    texto: "vence hoy",
    clase: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
};

export function AlertaTareaBadge({ alerta }: { alerta: AlertaTarea }) {
  const tono = TONOS_ALERTA[alerta];
  if (!tono) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tono.clase}`}
    >
      {alerta === "vencida" ? <IconAlert className="h-3 w-3" /> : null}
      {tono.texto}
    </span>
  );
}
