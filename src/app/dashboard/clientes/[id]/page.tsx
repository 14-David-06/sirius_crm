import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { listarContactos, listarCultivos, obtenerCliente } from "@/lib/clientes";
import { hoyEnBogota, listarCasosPendientes, listarVisitas } from "@/lib/crm";
import { getSession } from "@/lib/session";
import {
  IconChevronLeft,
  IconLifebuoy,
  IconMail,
  IconPhone,
  IconPlus,
} from "../../icons";
import { Shell } from "../../shell";
import { Estado, formatearFecha } from "../lista";

export const dynamic = "force-dynamic";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

const card =
  "rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";

export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  if (!RECORD_ID.test(id)) {
    notFound();
  }

  const cliente = await obtenerCliente(id);
  if (!cliente) {
    notFound();
  }

  const [contactos, cultivos, visitas, casos] = await Promise.all([
    listarContactos(),
    listarCultivos(),
    listarVisitas(),
    listarCasosPendientes(),
  ]);

  const hoy = hoyEnBogota();

  const susContactos = contactos.filter((contacto) =>
    contacto.clientes.includes(cliente.recordId),
  );
  const susCultivos = cultivos.filter((cultivo) =>
    cultivo.clientes.includes(cliente.recordId),
  );

  // Las visitas referencian el serial ("CL-0007"); el nombre es el respaldo.
  const susVisitas = visitas
    .filter(
      (visita) =>
        (cliente.id && visita.idClienteCore === cliente.id) ||
        visita.cliente === cliente.nombre,
    )
    .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));

  const susCasos = casos.filter((caso) => caso.cliente === cliente.nombre);

  const pendientes = susVisitas
    .filter((visita) => visita.fechaSeguimiento)
    .map((visita) => visita.fechaSeguimiento!.slice(0, 10))
    .sort();

  const ubicacion = [cliente.ciudad, cliente.departamento]
    .filter(Boolean)
    .join(", ");

  return (
    <Shell nombre={session.nombre} rol={session.rol}>
      <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
        <div>
          <Link
            href="/dashboard/clientes"
            className="inline-flex items-center gap-1 rounded text-xs font-medium text-slate-600 transition-colors duration-200 hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-400 dark:hover:text-blue-300"
          >
            <IconChevronLeft className="h-3.5 w-3.5" />
            Clientes
          </Link>

          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                  {cliente.nombre}
                </h1>
                <Estado activo={cliente.activo} />
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {cliente.id || "sin código"}
                {ubicacion ? ` · ${ubicacion}` : ""}
                {cliente.nit ? ` · NIT ${cliente.nit}` : ""}
              </p>
            </div>

            <Link
              href="/dashboard/visitas"
              className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <IconPlus className="h-4 w-4" />
              Registrar visita
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metrica titulo="Visitas registradas" valor={String(susVisitas.length)} />
          <Metrica
            titulo="Última visita"
            valor={formatearFecha(susVisitas[0]?.fecha ?? null)}
          />
          <Metrica
            titulo="Próximo seguimiento"
            valor={formatearFecha(pendientes.find((f) => f >= hoy) ?? null)}
            alerta={pendientes.some((f) => f < hoy)}
            detalle={
              pendientes.some((f) => f < hoy) ? "Hay compromisos vencidos" : null
            }
          />
          <Metrica
            titulo="Casos abiertos"
            valor={String(susCasos.length)}
            alerta={susCasos.length > 0}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* --------------------------- Datos ---------------------------- */}
          <section className={`${card} p-5`}>
            <h2 className="text-base font-semibold tracking-tight">
              Datos generales
            </h2>
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Dato etiqueta="NIT" valor={cliente.nit} />
              <Dato etiqueta="Dirección" valor={cliente.direccion} />
              <Dato etiqueta="Ciudad" valor={cliente.ciudad} />
              <Dato etiqueta="Departamento" valor={cliente.departamento} />
              <Dato
                etiqueta="Distancia a bodega"
                valor={
                  cliente.distanciaBodegaKm === null
                    ? null
                    : `${cliente.distanciaBodegaKm} km`
                }
              />
              <Dato
                etiqueta="Cliente desde"
                valor={formatearFecha(cliente.creado)}
              />
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500">
                  Coordenadas
                </dt>
                <dd className="mt-1 text-sm">
                  {cliente.coordenadas ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.coordenadas)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded text-blue-800 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-blue-300"
                    >
                      {cliente.coordenadas}
                    </a>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-500">—</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* ------------------------- Contactos --------------------------- */}
          <section className={`${card} p-5`}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold tracking-tight">
                Contactos
              </h2>
              <span className="text-xs text-slate-600 tabular-nums dark:text-slate-400">
                {susContactos.length}
              </span>
            </div>

            {susContactos.length === 0 ? (
              <Vacio texto="Este cliente no tiene personal registrado en Sirius Clients Core." />
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {susContactos.map((contacto) => (
                  <li
                    key={contacto.recordId}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{contacto.nombre}</p>
                      {contacto.activo ? null : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                          Inactivo
                        </span>
                      )}
                    </div>
                    {contacto.cargo ? (
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                        {contacto.cargo}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {contacto.telefono ? (
                        <a
                          href={`tel:${contacto.telefono.replace(/\s/g, "")}`}
                          className="flex items-center gap-1.5 rounded text-slate-700 hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-300 dark:hover:text-blue-300"
                        >
                          <IconPhone className="h-3.5 w-3.5" />
                          {contacto.telefono}
                        </a>
                      ) : null}
                      {contacto.email ? (
                        <a
                          href={`mailto:${contacto.email}`}
                          className="flex items-center gap-1.5 rounded text-slate-700 hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-300 dark:hover:text-blue-300"
                        >
                          <IconMail className="h-3.5 w-3.5" />
                          {contacto.email}
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* --------------------------- Cultivos ---------------------------- */}
        <section className={`${card} p-5`}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight">
              Cultivos y lotes
            </h2>
            <span className="text-xs text-slate-600 tabular-nums dark:text-slate-400">
              {susCultivos.length}
            </span>
          </div>

          {susCultivos.length === 0 ? (
            <Vacio texto="Sin cultivos asociados." />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {susCultivos.map((cultivo) => (
                <article
                  key={cultivo.recordId}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{cultivo.nombre}</p>
                    <Estado activo={cultivo.estado !== "Inactivo"} />
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {cultivo.tipo ?? "Sin tipo"} · {cultivo.lotes}{" "}
                    {cultivo.lotes === 1 ? "lote" : "lotes"}
                  </p>
                  {cultivo.tecnico ? (
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
                      Técnico: {cultivo.tecnico}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ----------------------- Casos abiertos -------------------------- */}
        {susCasos.length > 0 ? (
          <section className={`${card} p-5`}>
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <IconLifebuoy className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              Casos abiertos
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {susCasos.map((caso) => {
                const limite = caso.fechaLimite?.slice(0, 10) ?? null;
                const vencido = Boolean(limite && limite < hoy);

                return (
                  <li
                    key={caso.recordId}
                    className={`rounded-lg border border-l-4 border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5 ${
                      vencido ? "border-l-red-500" : "border-l-amber-500"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {caso.tipo ?? "Caso"}
                        <span className="ml-2 text-xs font-normal text-slate-500 tabular-nums dark:text-slate-500">
                          {caso.id}
                        </span>
                      </p>
                      <span
                        className={`text-xs font-semibold ${
                          vencido
                            ? "text-red-700 dark:text-red-300"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        Límite {formatearFecha(limite)}
                      </span>
                    </div>
                    {caso.descripcion ? (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {caso.descripcion}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* --------------------- Historial de visitas ---------------------- */}
        <section className={`${card} p-5`}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight">
              Historial de visitas
            </h2>
            <span className="text-xs text-slate-600 tabular-nums dark:text-slate-400">
              {susVisitas.length}
            </span>
          </div>

          {susVisitas.length === 0 ? (
            <Vacio texto="Todavía no se ha registrado ninguna visita a este cliente." />
          ) : (
            <div className="-mx-5 mt-4 overflow-x-auto">
              <table className="w-full min-w-[54rem] text-sm">
                <thead>
                  <tr className="border-y border-slate-200 text-left text-xs tracking-wide text-slate-600 uppercase dark:border-white/10 dark:text-slate-400">
                    {[
                      "Fecha",
                      "Tipo",
                      "Responsable",
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
                  {susVisitas.map((visita) => (
                    <tr key={visita.recordId}>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {formatearFecha(visita.fecha)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {visita.tipo ?? "—"}
                      </td>
                      <td className="px-5 py-3">{visita.responsable ?? "—"}</td>
                      <td className="max-w-xs px-5 py-3">
                        {visita.objetivo ?? "—"}
                      </td>
                      <td className="px-5 py-3">{visita.resultado ?? "—"}</td>
                      <td className="max-w-xs px-5 py-3">
                        {visita.proximaAccion ?? "—"}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {formatearFecha(visita.fechaSeguimiento)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}

function Metrica({
  titulo,
  valor,
  detalle,
  alerta,
}: {
  titulo: string;
  valor: string;
  detalle?: string | null;
  alerta?: boolean;
}) {
  return (
    <article className={`${card} p-5`}>
      <p className="text-sm text-slate-600 dark:text-slate-400">{titulo}</p>
      <p
        className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${
          alerta ? "text-red-700 dark:text-red-300" : ""
        }`}
      >
        {valor}
      </p>
      {detalle ? (
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {detalle}
        </p>
      ) : null}
    </article>
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
        {valor && valor !== "—" ? (
          valor
        ) : (
          <span className="text-slate-500 dark:text-slate-500">—</span>
        )}
      </dd>
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="mt-6 pb-2 text-center text-sm text-slate-600 dark:text-slate-400">
      {texto}
    </p>
  );
}
