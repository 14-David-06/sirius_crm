import Link from "next/link";

import { motivoSinAcceso, type Permisos } from "@/lib/permisos";
import { IconLifebuoy } from "./icons";

/**
 * Pantalla para un módulo que la sesión no puede abrir. Dice el motivo en vez
 * de mostrar una tabla vacía, que se confunde con "no hay datos".
 */
export function SinAcceso({
  modulo,
  permisos,
}: {
  modulo: string;
  permisos: Permisos;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-10">
      <div className="tarjeta3d rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-slate-900">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400">
          <IconLifebuoy className="h-6 w-6" />
        </span>

        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          {modulo} no está disponible para tu nivel
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
          {motivoSinAcceso(permisos)}
        </p>

        <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
          Sí puedes ver tus propias{" "}
          <Link
            href="/dashboard/visitas"
            className="rounded font-medium text-blue-800 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-blue-300"
          >
            visitas
          </Link>{" "}
          y{" "}
          <Link
            href="/dashboard/casos"
            className="rounded font-medium text-blue-800 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-blue-300"
          >
            casos
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
