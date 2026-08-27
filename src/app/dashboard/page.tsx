import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
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

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <Shell nombre={session.nombre} rol={session.rol}>
      <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Hola, {primerNombre(session.nombre)}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Este es el estado de tu operación comercial hoy.
            </p>
          </div>
          <BarraFiltros />
        </div>

        <FilaKpis />

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
          Los datos de esta vista son de ejemplo. La sesión sí es real:{" "}
          {session.idEmpleado} · {session.nivelAcceso ?? "sin nivel asignado"}.
        </p>
      </div>
    </Shell>
  );
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? "";
}
