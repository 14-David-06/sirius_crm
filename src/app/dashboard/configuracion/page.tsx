import { redirect } from "next/navigation";

import { listarAccesosEquipo } from "@/lib/airtable";
import { describirPermisos, permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";
import { Shell } from "../shell";
import { CambiarPassword } from "./cambiar-password";

// Los niveles se leen de Sirius Nomina Core y pueden cambiar en cualquier momento.
export const dynamic = "force-dynamic";

const card =
  "tarjeta3d rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";

export default async function ConfiguracionPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const permisos = permisosDe(session);

  // La lista del equipo solo la carga quien puede gestionar usuarios: no se
  // trae de Airtable para luego esconderla en el cliente.
  const equipo = permisos.gestionUsuarios ? await listarAccesosEquipo() : [];

  return (
    <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Configuración
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Tu cuenta, tu nivel de acceso y tu contraseña.
          </p>
        </div>

        {/* ------------------------------ Cuenta ------------------------------ */}
        <section className={`${card} p-5`}>
          <h2 className="text-base font-semibold tracking-tight">Mi cuenta</h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Estos datos vienen de Sirius Nomina Core. Para corregirlos, habla
            con Gestión Humana: el CRM solo los lee.
          </p>

          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Dato etiqueta="Nombre" valor={session.nombre} />
            <Dato etiqueta="Cédula" valor={session.cedula} />
            <Dato etiqueta="ID de empleado" valor={session.idEmpleado} />
            <Dato etiqueta="Rol" valor={session.rol} />
            <Dato etiqueta="Nivel de acceso" valor={permisos.nivel} />
          </dl>
        </section>

        {/* ------------------------------ Permisos ---------------------------- */}
        <section className={`${card} p-5`}>
          <h2 className="text-base font-semibold tracking-tight">
            Qué permite tu nivel
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {permisos.nivel
              ? `Lo que el nivel ${permisos.nivel} puede hacer dentro del CRM.`
              : "Tu usuario no tiene nivel asignado, así que el CRM aplica el mínimo: solo lectura de lo propio."}
          </p>

          <ul className="mt-4 flex flex-col gap-2">
            {describirPermisos(permisos).map((permiso) => (
              <li
                key={permiso.etiqueta}
                className="flex items-start gap-2.5 text-sm"
              >
                <Marca permitido={permiso.permitido} />
                <span
                  className={
                    permiso.permitido
                      ? ""
                      : "text-slate-500 dark:text-slate-500"
                  }
                >
                  {permiso.etiqueta}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ----------------------------- Contraseña --------------------------- */}
        <section className={`${card} p-5`}>
          <h2 className="text-base font-semibold tracking-tight">Contraseña</h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Te pedimos la actual para confirmar que eres tú, incluso con la
            sesión abierta.
          </p>

          <CambiarPassword />
        </section>

        {/* ------------------------------- Equipo ----------------------------- */}
        {permisos.gestionUsuarios ? (
          <section className={`${card} p-5`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold tracking-tight">
                Accesos del equipo
              </h2>
              <span className="text-xs text-slate-600 tabular-nums dark:text-slate-400">
                {equipo.length} activos ·{" "}
                {equipo.filter((p) => !p.tieneClave).length} sin contraseña
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              El nivel se asigna en Sirius Nomina Core, en el campo
              Nivel_Sistema_Nuevo. Aquí se ve el efecto, no se edita.
            </p>

            <div className="-mx-5 mt-4 overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-y border-slate-200 text-left text-xs tracking-wide text-slate-600 uppercase dark:border-white/10 dark:text-slate-400">
                    {["Persona", "Rol", "Nivel de acceso", "Contraseña"].map(
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
                  {equipo.map((persona) => (
                    <tr key={persona.idEmpleado || persona.nombre}>
                      <td className="px-5 py-3">
                        {persona.nombre}
                        <span className="block text-xs text-slate-500 tabular-nums dark:text-slate-500">
                          {persona.idEmpleado || "sin ID"}
                        </span>
                      </td>
                      <td className="px-5 py-3">{persona.rol ?? "—"}</td>
                      <td className="px-5 py-3">
                        <Nivel nivel={persona.nivelAcceso} />
                      </td>
                      <td className="px-5 py-3">
                        {persona.tieneClave ? (
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            Definida
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            Sin definir
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </Shell>
  );
}

function Dato({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string | null;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500">
        {etiqueta}
      </dt>
      <dd className="mt-1 text-sm">
        {valor ? (
          valor
        ) : (
          <span className="text-slate-500 dark:text-slate-500">
            sin asignar
          </span>
        )}
      </dd>
    </div>
  );
}

function Marca({ permitido }: { permitido: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
        permitido
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
          : "bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-slate-500"
      }`}
    >
      {permitido ? "✓" : "—"}
      <span className="sr-only">{permitido ? "Permitido" : "No permitido"}</span>
    </span>
  );
}

function Nivel({ nivel }: { nivel: string | null }) {
  if (!nivel) {
    return (
      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
        Sin asignar
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-white/10">
      {nivel}
    </span>
  );
}
