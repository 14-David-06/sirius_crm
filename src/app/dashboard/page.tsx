import { redirect } from "next/navigation";

import { formatearFecha } from "@/lib/fechas";
import { cargarInicio } from "@/lib/inicio";
import { getSession } from "@/lib/session";
import { CalendarioPendientes } from "./calendario";
import { Shell } from "./shell";
import {
  Actividad,
  Casos,
  Equipo,
  FilaKpis,
  GraficoVisitas,
  ResultadoDeVisitas,
  TablaSeguimientos,
  TopClientes,
} from "./widgets";

// Todo el home sale de Airtable en cada carga: no debe quedarse cacheado.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const inicio = await cargarInicio();

  return (
    <Shell nombre={session.nombre} rol={session.rol}>
      <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Hola, {primerNombre(session.nombre)}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Este es el estado de tu operación comercial hoy.
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Datos al {formatearFecha(inicio.hoy)}
          </p>
        </div>

        {inicio.error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          >
            No pudimos leer Airtable, así que esta vista está vacía. No
            significa que no tengas actividad: vuelve a cargar en un momento.
          </p>
        ) : null}

        <FilaKpis kpis={inicio.kpis} />

        <CalendarioPendientes
          pendientes={inicio.pendientes}
          hoy={inicio.hoy}
          error={inicio.error}
          usuario={session.nombre}
        />

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <GraficoVisitas puntos={inicio.visitasPorMes} />
          </div>
          <ResultadoDeVisitas resultados={inicio.resultados} />
        </div>

        <TablaSeguimientos filas={inicio.seguimientos} />

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <Actividad items={inicio.actividad} />
          <Casos
            casos={inicio.casos}
            abiertos={inicio.casosAbiertos}
            vencidos={inicio.casosVencidos}
          />
          <div className="flex flex-col gap-6 lg:col-span-2 xl:col-span-1">
            <TopClientes clientes={inicio.topClientes} />
            <Equipo personas={inicio.equipo} />
          </div>
        </div>
      </div>
    </Shell>
  );
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? "";
}
