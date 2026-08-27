import { redirect } from "next/navigation";

import { cargarAgenda } from "@/lib/agenda";
import { getSession } from "@/lib/session";
import { CalendarioPendientes } from "./calendario";
import { Shell } from "./shell";
import {
  Actividad,
  BarraFiltros,
  Casos,
  Embudo,
  Equipo,
  FilaKpis,
  GraficoVentas,
  Pipeline,
  TablaSeguimientos,
  Tareas,
  TopClientes,
} from "./widgets";

// La agenda sale de Airtable en cada carga: no debe quedarse cacheada.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const agenda = await cargarAgenda();

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
          <BarraFiltros />
        </div>

        <FilaKpis />

        <CalendarioPendientes
          pendientes={agenda.pendientes}
          hoy={agenda.hoy}
          error={agenda.error}
          usuario={session.nombre}
        />

        <Pipeline />

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <GraficoVentas />
          </div>
          <Embudo />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <TablaSeguimientos />
          </div>
          <Tareas />
        </div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <Actividad />
          <Casos />
          <div className="flex flex-col gap-6 lg:col-span-2 xl:col-span-1">
            <TopClientes />
            <Equipo />
          </div>
        </div>

        <p className="pb-2 text-center text-xs text-slate-500 dark:text-slate-500">
          La agenda de pendientes viene de Airtable; el resto de esta vista
          todavía es de ejemplo. La sesión sí es real:{" "}
          {session.idEmpleado} · {session.nivelAcceso ?? "sin nivel asignado"}.
        </p>
      </div>
    </Shell>
  );
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? "";
}
