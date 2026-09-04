"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { Cliente, ContactoCliente } from "@/lib/clientes";
import type { Cotizacion, LineaCotizacion } from "@/lib/cotizaciones";
import {
  cierraCotizacion,
  coincideCotizacion,
  ESTADOS_COTIZACION,
  estaCerradaCotizacion,
  FILTROS_COTIZACION_VACIOS,
  formatearCantidad,
  formatearPesos,
  formatearRevision,
  formatearVigencia,
  siguientesEstadosCotizacion,
  type FiltrosCotizacion,
} from "@/lib/cotizaciones-comun";
import { formatearFecha } from "@/lib/fechas";
import { motivoSinAcceso, puedeEditar, type Permisos } from "@/lib/permisos";
import type { Producto } from "@/lib/productos";
import {
  IconChevronRight,
  IconFile,
  IconFilter,
  IconPlus,
  IconSearch,
} from "../icons";
import { FormularioCotizacion } from "./formulario-cotizacion";

const card =
  "tarjeta3d rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";
const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";

export type LineaConNombre = LineaCotizacion & { productoNombre: string };

export type FilaCotizacion = Omit<Cotizacion, "lineas"> & {
  clienteNombre: string;
  lineas: LineaConNombre[];
  /** Si ya se pasó de su vigencia, medido contra hoy en Bogotá. */
  vencida: boolean;
};

type Props = {
  cotizaciones: FilaCotizacion[];
  clientes: Cliente[];
  contactos: ContactoCliente[];
  productos: Producto[];
  sesion: { idEmpleado: string; nombre: string };
  hoy: string;
  permisos: Permisos;
};

export function ModuloCotizaciones({
  cotizaciones,
  clientes,
  contactos,
  productos,
  sesion,
  hoy,
  permisos,
}: Props) {
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosCotizacion>(
    FILTROS_COTIZACION_VACIOS,
  );
  const [abierta, setAbierta] = useState<string | null>(null);

  function filtrar(cambios: Partial<FiltrosCotizacion>) {
    setFiltros((previos) => ({ ...previos, ...cambios }));
  }

  /** Las opciones salen de lo visible, no de los catálogos: filtrar por algo
   *  que no está en la tabla solo produce listas vacías. */
  const opciones = useMemo(() => {
    const clientes = new Set<string>();
    const productos = new Set<string>();
    const responsables = new Set<string>();

    for (const cotizacion of cotizaciones) {
      clientes.add(cotizacion.clienteNombre);
      if (cotizacion.responsable) responsables.add(cotizacion.responsable);
      for (const linea of cotizacion.lineas) productos.add(linea.productoNombre);
    }

    const ordenar = (valores: Set<string>) =>
      [...valores].sort((a, b) => a.localeCompare(b, "es"));

    return {
      clientes: ordenar(clientes),
      productos: ordenar(productos),
      responsables: ordenar(responsables),
    };
  }, [cotizaciones]);

  const resumen = useMemo(() => {
    const abiertas = cotizaciones.filter(
      (c) => !estaCerradaCotizacion(c.estado),
    );
    const aceptadas = cotizaciones.filter((c) => c.estado === "Aceptada");
    const decididas = cotizaciones.filter(
      (c) => c.estado === "Aceptada" || c.estado === "Rechazada",
    );

    return {
      abiertas: abiertas.length,
      // Una oferta vencida que nadie cerró es la que hay que perseguir hoy.
      vencidas: abiertas.filter((c) => c.vencida).length,
      montoAbierto: abiertas.reduce((suma, c) => suma + c.total, 0),
      // Sobre lo decidido, no sobre el total: incluir las que aún no responden
      // haría bajar la tasa solo por emitir más.
      tasa:
        decididas.length === 0
          ? null
          : Math.round((aceptadas.length / decididas.length) * 100),
    };
  }, [cotizaciones]);

  const filtradas = useMemo(
    () =>
      cotizaciones.filter((cotizacion) =>
        coincideCotizacion(
          {
            ...cotizacion,
            cliente: cotizacion.clienteNombre,
            lineas: cotizacion.lineas.map((linea) => ({
              producto: linea.productoNombre,
            })),
          },
          filtros,
        ),
      ),
    [cotizaciones, filtros],
  );

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Cotizaciones
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Qué se le ofertó a cada cliente, por cuánto y en qué quedó.
          </p>
        </div>

        {permisos.crear ? (
          <button
            type="button"
            onClick={() => setFormularioAbierto(true)}
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <IconPlus className="h-4 w-4" />
            Emitir cotización
          </button>
        ) : null}
      </div>

      {permisos.verTodo ? null : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {motivoSinAcceso(permisos)}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Resumen titulo="Cotizaciones abiertas" valor={String(resumen.abiertas)} />
        <Resumen
          titulo="Vencidas sin cerrar"
          valor={String(resumen.vencidas)}
          tono={resumen.vencidas > 0 ? "ambar" : undefined}
        />
        <Resumen
          titulo="Monto en negociación"
          valor={formatearPesos(resumen.montoAbierto)}
        />
        <Resumen
          titulo="Tasa de aceptación"
          valor={resumen.tasa === null ? "—" : `${resumen.tasa} %`}
        />
      </div>

      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1 lg:max-w-md">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <label htmlFor="buscar-cotizacion" className="sr-only">
              Buscar cotizaciones
            </label>
            <input
              id="buscar-cotizacion"
              type="search"
              value={filtros.termino}
              onChange={(e) => filtrar({ termino: e.target.value })}
              placeholder="Buscar por cliente, consecutivo, título o producto…"
              className={`${input} pl-9`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            <IconFilter className="h-4 w-4 text-slate-500 dark:text-slate-400" />

            <label htmlFor="filtro-estado-cotizacion" className="sr-only">
              Estado de la cotización
            </label>
            <select
              id="filtro-estado-cotizacion"
              value={filtros.estado}
              onChange={(e) => filtrar({ estado: e.target.value })}
              className={`${input} w-auto cursor-pointer`}
            >
              <option value="abiertas">Abiertas</option>
              <option value="por-vencer">Vencidas sin cerrar</option>
              {ESTADOS_COTIZACION.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
              <option value="cerradas">Cerradas</option>
              <option value="todos">Todas</option>
            </select>

            <label htmlFor="filtro-cliente-cotizacion" className="sr-only">
              Cliente
            </label>
            <select
              id="filtro-cliente-cotizacion"
              value={filtros.cliente}
              onChange={(e) => filtrar({ cliente: e.target.value })}
              className={`${input} w-auto max-w-48 cursor-pointer`}
            >
              <option value="">Todo cliente</option>
              {opciones.clientes.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>

            <label htmlFor="filtro-producto-cotizacion" className="sr-only">
              Producto
            </label>
            <select
              id="filtro-producto-cotizacion"
              value={filtros.producto}
              onChange={(e) => filtrar({ producto: e.target.value })}
              className={`${input} w-auto max-w-48 cursor-pointer`}
            >
              <option value="">Todo producto</option>
              {opciones.productos.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>

            <label htmlFor="filtro-responsable-cotizacion" className="sr-only">
              Responsable
            </label>
            <select
              id="filtro-responsable-cotizacion"
              value={filtros.responsable}
              onChange={(e) => filtrar({ responsable: e.target.value })}
              className={`${input} w-auto max-w-48 cursor-pointer`}
            >
              <option value="">Todo responsable</option>
              {opciones.responsables.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5">
              <label htmlFor="filtro-desde-cotizacion" className="sr-only">
                Emitidas desde
              </label>
              <input
                id="filtro-desde-cotizacion"
                type="date"
                value={filtros.desde}
                max={filtros.hasta || undefined}
                onChange={(e) => filtrar({ desde: e.target.value })}
                className={`${input} w-auto cursor-pointer`}
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                a
              </span>
              <label htmlFor="filtro-hasta-cotizacion" className="sr-only">
                Emitidas hasta
              </label>
              <input
                id="filtro-hasta-cotizacion"
                type="date"
                value={filtros.hasta}
                min={filtros.desde || undefined}
                onChange={(e) => filtrar({ hasta: e.target.value })}
                className={`${input} w-auto cursor-pointer`}
              />
            </div>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <p className="mt-8 pb-4 text-center text-sm text-slate-600 dark:text-slate-400">
            {cotizaciones.length === 0
              ? "Todavía no hay cotizaciones que puedas ver."
              : "Ninguna cotización coincide con estos filtros."}
          </p>
        ) : (
          <div className="-mx-5 mt-4 overflow-x-auto">
            <table className="w-full min-w-[64rem] text-sm">
              <thead>
                <tr className="border-y border-slate-200 text-left text-xs tracking-wide text-slate-600 uppercase dark:border-white/10 dark:text-slate-400">
                  {[
                    "Cotización",
                    "Cliente",
                    "Emitida",
                    "Vigencia",
                    "Total",
                    "Estado",
                    "",
                    "",
                  ].map((columna, indice) => (
                    <th
                      key={columna || `col-${indice}`}
                      scope="col"
                      className="px-5 py-2.5 font-semibold whitespace-nowrap"
                    >
                      {columna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filtradas.map((cotizacion) => (
                  <FilaCotizacionTabla
                    key={cotizacion.recordId}
                    cotizacion={cotizacion}
                    abierta={abierta === cotizacion.recordId}
                    onAlternar={() =>
                      setAbierta((actual) =>
                        actual === cotizacion.recordId
                          ? null
                          : cotizacion.recordId,
                      )
                    }
                    editable={puedeEditar(
                      permisos,
                      {
                        idPersonalCore: cotizacion.idPersonalCore,
                        responsable: cotizacion.responsable,
                      },
                      sesion,
                    )}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formularioAbierto ? (
        <FormularioCotizacion
          clientes={clientes}
          contactos={contactos}
          productos={productos}
          sesion={sesion}
          hoy={hoy}
          onCerrar={() => setFormularioAbierto(false)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------ Fila y detalle --------------------------- */

function FilaCotizacionTabla({
  cotizacion,
  abierta,
  onAlternar,
  editable,
}: {
  cotizacion: FilaCotizacion;
  abierta: boolean;
  onAlternar: () => void;
  editable: boolean;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destino, setDestino] = useState("");
  const [motivo, setMotivo] = useState("");

  const opciones = siguientesEstadosCotizacion(cotizacion.estado);
  const pideMotivo = destino !== "" && cierraCotizacion(destino);

  async function mover() {
    if (!destino) return;

    setGuardando(true);
    setError(null);

    const respuesta = await fetch(`/api/cotizaciones/${cotizacion.recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: destino,
        motivoCierre: motivo.trim() || undefined,
      }),
    });
    const data = (await respuesta.json().catch(() => ({}))) as {
      error?: string;
    };

    setGuardando(false);

    if (!respuesta.ok) {
      setError(data.error ?? "No pudimos actualizar la cotización.");
      return;
    }

    setDestino("");
    setMotivo("");
    router.refresh();
  }

  return (
    <>
      <tr className="transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-white/5">
        <td className="px-5 py-3 font-semibold whitespace-nowrap tabular-nums">
          {cotizacion.id}
          {cotizacion.revision > 0 ? (
            <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-500">
              {formatearRevision(cotizacion.revision)}
            </span>
          ) : null}
          {cotizacion.titulo ? (
            <span className="block text-xs font-normal text-slate-500 dark:text-slate-500">
              {cotizacion.titulo}
            </span>
          ) : null}
        </td>
        <td className="px-5 py-3">
          {cotizacion.clienteNombre}
          {cotizacion.responsable ? (
            <span className="block text-xs text-slate-500 dark:text-slate-500">
              {cotizacion.responsable}
            </span>
          ) : null}
        </td>
        <td className="px-5 py-3 whitespace-nowrap">
          {formatearFecha(cotizacion.fechaEmision)}
        </td>
        <td className="px-5 py-3 whitespace-nowrap">
          <Vigencia cotizacion={cotizacion} />
        </td>
        <td className="px-5 py-3 whitespace-nowrap tabular-nums">
          {cotizacion.lineas.length === 0
            ? "—"
            : formatearPesos(cotizacion.total)}
          {cotizacion.iva === null && cotizacion.lineas.length > 0 ? (
            <span className="block text-xs font-normal text-slate-500 dark:text-slate-500">
              IVA por confirmar
            </span>
          ) : null}
        </td>
        <td className="px-5 py-3">
          <EstadoBadge estado={cotizacion.estado} />
        </td>
        <td className="px-5 py-3">
          <Link
            href={`/dashboard/cotizaciones/${cotizacion.recordId}/documento`}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-800 transition-colors duration-200 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-blue-300 dark:hover:bg-blue-500/15"
          >
            <IconFile className="h-3.5 w-3.5" />
            Documento
          </Link>
        </td>
        <td className="px-5 py-3 text-right">
          <button
            type="button"
            onClick={onAlternar}
            aria-expanded={abierta}
            className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-300 dark:hover:bg-white/10"
          >
            {abierta ? "Ocultar" : "Ver"}
            <IconChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                abierta ? "rotate-90" : ""
              }`}
            />
          </button>
        </td>
      </tr>

      {abierta ? (
        <tr className="bg-slate-50 dark:bg-white/5">
          <td colSpan={8} className="px-5 py-4">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div>
                <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500">
                  Renglones de la oferta
                </h3>

                {cotizacion.lineas.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Esta cotización no tiene renglones cargados.
                  </p>
                ) : (
                  <table className="mt-2 w-full text-sm">
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                      {cotizacion.lineas.map((linea) => (
                        <tr key={linea.recordId}>
                          <td className="py-2 pr-4">{linea.productoNombre}</td>
                          <td className="py-2 pr-4 whitespace-nowrap tabular-nums">
                            {formatearCantidad(linea.cantidad)}
                            {linea.unidad ? ` ${linea.unidad}` : ""}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap text-slate-600 tabular-nums dark:text-slate-400">
                            {formatearPesos(linea.precioUnitario)}
                          </td>
                          <td className="py-2 text-right font-medium whitespace-nowrap tabular-nums">
                            {formatearPesos(linea.subtotal)}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} className="py-2 text-slate-600 dark:text-slate-400">
                          Subtotal
                        </td>
                        <td className="py-2 text-right whitespace-nowrap tabular-nums">
                          {formatearPesos(cotizacion.subtotal)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="py-2 text-slate-600 dark:text-slate-400">
                          IVA
                          {cotizacion.ivaPorcentaje !== null
                            ? ` ${cotizacion.ivaPorcentaje} %`
                            : ""}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap tabular-nums">
                          {cotizacion.iva === null
                            ? "Por confirmar"
                            : formatearPesos(cotizacion.iva)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {cotizacion.observaciones ? (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Observaciones:{" "}
                    </span>
                    {cotizacion.observaciones}
                  </p>
                ) : null}

                {cotizacion.notasInternas ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Notas internas:{" "}
                    </span>
                    {cotizacion.notasInternas}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500">
                    Condiciones
                  </h3>
                  <dl className="mt-2 flex flex-col gap-1.5 text-sm">
                    <Dato etiqueta="Atención" valor={cotizacion.contacto} />
                    <Dato etiqueta="Entrega" valor={cotizacion.modalidadEntrega} />
                    <Dato etiqueta="Punto" valor={cotizacion.puntoEntrega} />
                    <Dato
                      etiqueta="Flete"
                      valor={
                        cotizacion.valorFlete === null
                          ? null
                          : formatearPesos(cotizacion.valorFlete)
                      }
                    />
                    <Dato etiqueta="Pago" valor={cotizacion.formaPago} />
                    <Dato etiqueta="OC" valor={cotizacion.ordenCompra} />
                    <Dato
                      etiqueta="Despacho"
                      valor={
                        cotizacion.fechaDespacho
                          ? formatearFecha(cotizacion.fechaDespacho)
                          : null
                      }
                    />
                    <Dato
                      etiqueta="Enviada"
                      valor={
                        cotizacion.fechaEnvio
                          ? formatearFecha(cotizacion.fechaEnvio)
                          : null
                      }
                    />
                    <Dato
                      etiqueta="Cerrada"
                      valor={
                        cotizacion.fechaCierre
                          ? formatearFecha(cotizacion.fechaCierre)
                          : null
                      }
                    />
                    <Dato etiqueta="Motivo" valor={cotizacion.motivoCierre} />
                  </dl>
                </div>

                {editable && opciones.length > 0 ? (
                  <div>
                    <label
                      htmlFor={`estado-cot-${cotizacion.recordId}`}
                      className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500"
                    >
                      Mover a
                    </label>
                    <select
                      id={`estado-cot-${cotizacion.recordId}`}
                      value={destino}
                      disabled={guardando}
                      onChange={(e) => setDestino(e.target.value)}
                      className={`${input} mt-1 cursor-pointer`}
                    >
                      <option value="">Elegir estado…</option>
                      {opciones.map((valor) => (
                        <option key={valor} value={valor}>
                          {valor}
                        </option>
                      ))}
                    </select>

                    {pideMotivo ? (
                      <div className="mt-2">
                        <label
                          htmlFor={`motivo-cot-${cotizacion.recordId}`}
                          className="text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          Qué dijo el cliente *
                        </label>
                        <textarea
                          id={`motivo-cot-${cotizacion.recordId}`}
                          rows={2}
                          value={motivo}
                          disabled={guardando}
                          onChange={(e) => setMotivo(e.target.value)}
                          className={`${input} mt-1`}
                        />
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={mover}
                      disabled={guardando || !destino}
                      className="mt-2 cursor-pointer rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                      {guardando ? "Guardando…" : "Guardar estado"}
                    </button>

                    {error ? (
                      <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                        {error}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Dato({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string | null;
}) {
  if (!valor) return null;

  return (
    <div className="flex gap-2">
      <dt className="min-w-20 shrink-0 text-slate-500 dark:text-slate-500">
        {etiqueta}
      </dt>
      <dd className="flex-1 text-slate-700 dark:text-slate-300">{valor}</dd>
    </div>
  );
}

/* -------------------------------- Etiquetas ------------------------------ */

const TONOS_ESTADO: Record<string, string> = {
  Borrador: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
  Enviada: "bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  Aceptada:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Rechazada: "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  Vencida:
    "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  Anulada: "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-500",
};

function EstadoBadge({ estado }: { estado: string | null }) {
  if (!estado) {
    return <span className="text-slate-500 dark:text-slate-500">—</span>;
  }

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
        TONOS_ESTADO[estado] ??
        "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
      }`}
    >
      {estado}
    </span>
  );
}

/**
 * Hasta cuándo está en firme. Una oferta abierta que ya venció se marca: es
 * la que el cliente puede pedir que le respeten y ya no está vigente.
 */
function Vigencia({ cotizacion }: { cotizacion: FilaCotizacion }) {
  const texto = formatearVigencia(
    cotizacion.fechaEmision,
    cotizacion.vigenciaDias,
  );

  if (cotizacion.vencida && !estaCerradaCotizacion(cotizacion.estado)) {
    return (
      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
        Vencida
      </span>
    );
  }

  return (
    <span className="text-xs text-slate-600 dark:text-slate-400">{texto}</span>
  );
}

function Resumen({
  titulo,
  valor,
  tono,
}: {
  titulo: string;
  valor: string;
  tono?: "ambar";
}) {
  return (
    <article className={`${card} p-5`}>
      <p className="text-sm text-slate-600 dark:text-slate-400">{titulo}</p>
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${
          tono === "ambar" ? "text-amber-700 dark:text-amber-300" : ""
        }`}
      >
        {valor}
      </p>
    </article>
  );
}
