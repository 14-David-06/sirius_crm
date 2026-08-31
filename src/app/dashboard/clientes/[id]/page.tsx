import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { listarContactos, listarCultivos, obtenerCliente } from "@/lib/clientes";
import { describirCanal } from "@/lib/clientes-comun";
import { listarCasosPendientes } from "@/lib/casos";
import { hoyEnBogota, listarVisitas } from "@/lib/crm";
import { formatearFecha } from "@/lib/fechas";
import { permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";
import {
  IconChevronLeft,
  IconLifebuoy,
  IconPlus,
} from "../../icons";
import { Shell } from "../../shell";
import { SinAcceso } from "../../sin-acceso";
import { Estado } from "../lista";
import { AccionesCliente } from "./acciones-cliente";
import { ContactosCliente } from "./contactos-cliente";

export const dynamic = "force-dynamic";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

const card =
  "tarjeta3d rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";

export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const permisos = permisosDe(session);

  // La ficha completa de un cliente es dato de terceros.
  if (!permisos.verTodo) {
    return (
      <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
        <SinAcceso modulo="La ficha de cliente" permisos={permisos} />
      </Shell>
    );
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
  // La misma forma que usa el directorio: el formulario es el mismo.
  const contactosDelCliente = susContactos.map((contacto) => ({
    recordId: contacto.recordId,
    codigo: contacto.codigo,
    nombre: contacto.nombre,
    cargo: contacto.cargo,
    funciones: contacto.funciones,
    cedula: contacto.cedula,
    email: contacto.email,
    emailNotificacion: contacto.emailNotificacion,
    telefono: contacto.telefono,
    activo: contacto.activo,
    clientes: [
      {
        recordId: cliente.recordId,
        nombre: cliente.nombre,
        ciudad: cliente.ciudad,
        activo: cliente.activo,
      },
    ],
  }));

  // El campo es texto libre en Airtable: se ofrecen los ya usados por el equipo.
  const cargos = [
    ...new Set(
      contactos
        .map((contacto) => contacto.cargo)
        .filter((cargo): cargo is string => Boolean(cargo)),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));

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
    <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
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
                <h1 className="text-2xl font-semibold tracking-tight">
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

            <div className="flex flex-wrap items-start gap-2">
              {permisos.gestionarCatalogo ? (
                <AccionesCliente
                  activo={cliente.activo}
                  cliente={{
                    recordId: cliente.recordId,
                    nombre: cliente.nombre,
                    nit: cliente.nit,
                    direccion: cliente.direccion,
                    ciudad: cliente.ciudad,
                    departamento: cliente.departamento,
                    coordenadas: cliente.coordenadas,
                    distanciaBodegaKm: cliente.distanciaBodegaKm,
                    sector: cliente.sector,
                    segmento: cliente.segmento,
                    etapa: cliente.etapa,
                    responsableComercial: cliente.responsableComercial,
                    vinculacion: cliente.vinculacion,
                    observaciones: cliente.observaciones,
                    comoConocio: cliente.comoConocio,
                    comoConocioDetalle: cliente.comoConocioDetalle,
                  }}
                />
              ) : null}

              <Link
                href="/dashboard/visitas"
                className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <IconPlus className="h-4 w-4" />
                Registrar visita
              </Link>
            </div>
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
              <Dato
                etiqueta="¿Cómo nos conoció?"
                valor={describirCanal(
                  cliente.comoConocio,
                  cliente.comoConocioDetalle,
                )}
              />
              <Dato
                etiqueta="Fecha de vinculación"
                valor={formatearFecha(cliente.vinculacion)}
              />
              <Dato etiqueta="Sector o cultivo" valor={cliente.sector} />
              <Dato etiqueta="Segmento (potencial)" valor={cliente.segmento} />
              <Dato etiqueta="Etapa comercial" valor={cliente.etapa} />
              <Dato
                etiqueta="Responsable comercial"
                valor={cliente.responsableComercial}
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

              {cliente.observaciones ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500">
                    Observaciones
                  </dt>
                  <dd className="mt-1 text-sm whitespace-pre-line">
                    {cliente.observaciones}
                  </dd>
                </div>
              ) : null}
            </dl>

            {cliente.modificadoPor ? (
              <p className="mt-4 border-t border-slate-200 pt-3 text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-500">
                Última modificación desde el CRM por {cliente.modificadoPor}
                {cliente.creadoPor ? ` · creado por ${cliente.creadoPor}` : ""}
              </p>
            ) : null}
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

            <ContactosCliente
              contactos={contactosDelCliente}
              cliente={{
                recordId: cliente.recordId,
                nombre: cliente.nombre,
                ciudad: cliente.ciudad,
              }}
              cargos={cargos}
              puedeEditar={permisos.gestionarCatalogo}
            />
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
        className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${
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
