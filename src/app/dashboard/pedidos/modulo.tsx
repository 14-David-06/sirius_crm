"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { Cliente } from "@/lib/clientes";
import { formatearFecha } from "@/lib/fechas";
import type { LineaPedido, Pedido } from "@/lib/pedidos";
import {
  ESTADOS_PEDIDO,
  estaCerradoPedido,
  formatearCantidad,
  formatearPesos,
  siguientesEstados,
  type EstadoPedido,
} from "@/lib/pedidos-comun";
import { motivoSinAcceso, puedeEditar, type Permisos } from "@/lib/permisos";
import type { Producto } from "@/lib/productos";
import {
  IconChevronRight,
  IconFilter,
  IconPlus,
  IconSearch,
} from "../icons";
import { FormularioPedido } from "./formulario-pedido";

const card =
  "rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";
const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";

/** La línea con el nombre del producto ya resuelto desde su serial. */
export type LineaConProducto = LineaPedido & {
  producto: string;
  unidad: string | null;
};

/** Lo que el CRM muestra del despacho; la remisión la escribe logística. */
export type EntregaPedido = {
  id: string;
  estado: string | null;
  responsable: string | null;
  despachado: string | null;
  recibido: string | null;
};

export type FilaPedido = Omit<Pedido, "lineas"> & {
  cliente: string;
  lineas: LineaConProducto[];
  remisiones: EntregaPedido[];
};

type Props = {
  pedidos: FilaPedido[];
  clientes: Cliente[];
  productos: Producto[];
  personal: { nombre: string; rol: string | null; idEmpleado: string }[];
  sesion: { idEmpleado: string; nombre: string };
  hoy: string;
  permisos: Permisos;
};

export function ModuloPedidos({
  pedidos,
  clientes,
  productos,
  personal,
  sesion,
  hoy,
  permisos,
}: Props) {
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("abiertos");
  const [cliente, setCliente] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);

  const nombresCliente = useMemo(() => {
    const valores = new Set<string>();
    for (const pedido of pedidos) valores.add(pedido.cliente);
    return [...valores].sort((a, b) => a.localeCompare(b, "es"));
  }, [pedidos]);

  const resumen = useMemo(() => {
    const abiertos = pedidos.filter((p) => !estaCerradoPedido(p.estado));
    return {
      abiertos: abiertos.length,
      // "Sin despachar" es la pregunta que el cliente hace en campo.
      // Las dos miden sobre los pedidos abiertos: mezclar alcances haría que
      // la fila no sumara con la tabla que está justo debajo.
      sinDespachar: abiertos.filter((p) => p.remisiones.length === 0).length,
      enCamino: abiertos.filter((p) =>
        p.remisiones.some((r) => r.despachado && !r.recibido),
      ).length,
      montoAbierto: abiertos.reduce((suma, p) => suma + p.total, 0),
    };
  }, [pedidos]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return pedidos.filter((pedido) => {
      const texto = `${pedido.cliente} ${pedido.id} ${pedido.notas ?? ""} ${
        pedido.responsable ?? ""
      } ${pedido.lineas.map((l) => l.producto).join(" ")}`.toLowerCase();

      if (termino && !texto.includes(termino)) return false;
      if (estado === "abiertos" && estaCerradoPedido(pedido.estado)) {
        return false;
      }
      if (estado === "cerrados" && !estaCerradoPedido(pedido.estado)) {
        return false;
      }
      if (estado === "sin-despachar") {
        if (estaCerradoPedido(pedido.estado) || pedido.remisiones.length > 0) {
          return false;
        }
      }
      if (
        ESTADOS_PEDIDO.includes(estado as EstadoPedido) &&
        pedido.estado !== estado
      ) {
        return false;
      }
      if (cliente && pedido.cliente !== cliente) return false;

      return true;
    });
  }, [pedidos, busqueda, estado, cliente]);

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Qué pidió cada cliente, por cuánto, y si ya salió de bodega.
          </p>
        </div>

        {permisos.crear ? (
          <button
            type="button"
            onClick={() => setFormularioAbierto(true)}
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <IconPlus className="h-4 w-4" />
            Registrar pedido
          </button>
        ) : null}
      </div>

      {permisos.verTodo ? null : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {motivoSinAcceso(permisos)}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Resumen titulo="Pedidos abiertos" valor={String(resumen.abiertos)} />
        <Resumen
          titulo="Sin despachar"
          valor={String(resumen.sinDespachar)}
          tono={resumen.sinDespachar > 0 ? "ambar" : undefined}
        />
        <Resumen titulo="En camino" valor={String(resumen.enCamino)} />
        <Resumen
          titulo="Monto abierto"
          valor={formatearPesos(resumen.montoAbierto)}
        />
      </div>

      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1 lg:max-w-md">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <label htmlFor="buscar-pedido" className="sr-only">
              Buscar pedidos
            </label>
            <input
              id="buscar-pedido"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por cliente, código, producto o responsable…"
              className={`${input} pl-9`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            <IconFilter className="h-4 w-4 text-slate-500 dark:text-slate-400" />

            <label htmlFor="filtro-estado-pedido" className="sr-only">
              Estado del pedido
            </label>
            <select
              id="filtro-estado-pedido"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className={`${input} w-auto cursor-pointer`}
            >
              <option value="abiertos">Abiertos</option>
              <option value="sin-despachar">Sin despachar</option>
              {ESTADOS_PEDIDO.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
              <option value="cerrados">Completados y cancelados</option>
              <option value="todos">Todos</option>
            </select>

            <label htmlFor="filtro-cliente-pedido" className="sr-only">
              Cliente
            </label>
            <select
              id="filtro-cliente-pedido"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className={`${input} w-auto cursor-pointer`}
            >
              <option value="">Todo cliente</option>
              {nombresCliente.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <p className="mt-8 pb-4 text-center text-sm text-slate-600 dark:text-slate-400">
            {pedidos.length === 0
              ? "Todavía no hay pedidos que puedas ver."
              : "Ningún pedido coincide con estos filtros."}
          </p>
        ) : (
          <div className="-mx-5 mt-4 overflow-x-auto">
            <table className="w-full min-w-[64rem] text-sm">
              <thead>
                <tr className="border-y border-slate-200 text-left text-xs tracking-wide text-slate-600 uppercase dark:border-white/10 dark:text-slate-400">
                  {[
                    "Pedido",
                    "Cliente",
                    "Fecha",
                    "Productos",
                    "Total",
                    "Estado",
                    "Despacho",
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
                {filtrados.map((pedido) => (
                  <FilaPedidoTabla
                    key={pedido.recordId}
                    pedido={pedido}
                    abierto={abierto === pedido.recordId}
                    onAlternar={() =>
                      setAbierto((actual) =>
                        actual === pedido.recordId ? null : pedido.recordId,
                      )
                    }
                    editable={puedeEditar(
                      permisos,
                      {
                        idPersonalCore: pedido.idPersonalCore,
                        responsable: pedido.responsable,
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
        <FormularioPedido
          clientes={clientes}
          productos={productos}
          personal={personal}
          sesion={sesion}
          hoy={hoy}
          onCerrar={() => setFormularioAbierto(false)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------ Fila y detalle --------------------------- */

function FilaPedidoTabla({
  pedido,
  abierto,
  onAlternar,
  editable,
}: {
  pedido: FilaPedido;
  abierto: boolean;
  onAlternar: () => void;
  editable: boolean;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opciones = siguientesEstados(pedido.estado);
  const unidades = pedido.lineas.length;

  async function cambiarEstado(estado: string) {
    setGuardando(true);
    setError(null);

    const respuesta = await fetch(`/api/pedidos/${pedido.recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const data = (await respuesta.json().catch(() => ({}))) as {
      error?: string;
    };

    setGuardando(false);

    if (!respuesta.ok) {
      setError(data.error ?? "No pudimos actualizar el pedido.");
      return;
    }

    router.refresh();
  }

  return (
    <>
      <tr className="transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-white/5">
        <td className="px-5 py-3 font-semibold whitespace-nowrap tabular-nums">
          {pedido.id}
        </td>
        <td className="px-5 py-3">
          {pedido.cliente}
          {pedido.responsable ? (
            <span className="block text-xs text-slate-500 dark:text-slate-500">
              {pedido.responsable}
            </span>
          ) : null}
        </td>
        <td className="px-5 py-3 whitespace-nowrap">
          {formatearFecha(pedido.fecha)}
        </td>
        <td className="px-5 py-3 whitespace-nowrap">
          {unidades === 0
            ? "—"
            : `${unidades} ${unidades === 1 ? "renglón" : "renglones"}`}
        </td>
        <td className="px-5 py-3 whitespace-nowrap tabular-nums">
          {/* Cero es un total legítimo — las muestras comerciales van sin
              costo. Solo se muestra "—" cuando no hay renglones. */}
          {pedido.lineas.length === 0 ? "—" : formatearPesos(pedido.total)}
        </td>
        <td className="px-5 py-3">
          <EstadoBadge estado={pedido.estado} />
        </td>
        <td className="px-5 py-3">
          <Despacho remisiones={pedido.remisiones} estado={pedido.estado} />
        </td>
        <td className="px-5 py-3 text-right">
          <button
            type="button"
            onClick={onAlternar}
            aria-expanded={abierto}
            className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-300 dark:hover:bg-white/10"
          >
            {abierto ? "Ocultar" : "Ver"}
            <IconChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                abierto ? "rotate-90" : ""
              }`}
            />
          </button>
        </td>
      </tr>

      {abierto ? (
        <tr className="bg-slate-50 dark:bg-white/5">
          <td colSpan={8} className="px-5 py-4">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div>
                <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500">
                  Renglones del pedido
                </h3>

                {pedido.lineas.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Este pedido no tiene renglones cargados en Sirius Pedidos
                    Core.
                  </p>
                ) : (
                  <table className="mt-2 w-full text-sm">
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                      {pedido.lineas.map((linea) => (
                        <tr key={linea.recordId}>
                          <td className="py-2 pr-4">{linea.producto}</td>
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
                    </tbody>
                  </table>
                )}

                {pedido.notas ? (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Notas:{" "}
                    </span>
                    {pedido.notas}
                  </p>
                ) : null}
              </div>

              <div>
                <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500">
                  Despacho
                </h3>

                {pedido.remisiones.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Sin remisión registrada todavía.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {pedido.remisiones.map((remision) => (
                      <li
                        key={remision.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-white/10 dark:bg-slate-900"
                      >
                        <p className="font-semibold tabular-nums">
                          {remision.id}
                          {remision.estado ? (
                            <span className="ml-2 font-normal text-slate-600 dark:text-slate-400">
                              {remision.estado}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-slate-600 dark:text-slate-400">
                          Despachado {formatearFecha(remision.despachado)} ·
                          Recibido {formatearFecha(remision.recibido)}
                        </p>
                        {remision.responsable ? (
                          <p className="mt-0.5 text-slate-500 dark:text-slate-500">
                            {remision.responsable}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {editable && opciones.length > 0 ? (
                  <div className="mt-4">
                    <label
                      htmlFor={`estado-${pedido.recordId}`}
                      className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500"
                    >
                      Mover a
                    </label>
                    <select
                      id={`estado-${pedido.recordId}`}
                      value=""
                      disabled={guardando}
                      onChange={(e) => {
                        if (e.target.value) cambiarEstado(e.target.value);
                      }}
                      className={`${input} mt-1 cursor-pointer`}
                    >
                      <option value="">
                        {guardando ? "Guardando…" : "Elegir estado…"}
                      </option>
                      {opciones.map((valor) => (
                        <option key={valor} value={valor}>
                          {valor}
                        </option>
                      ))}
                    </select>
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

/* -------------------------------- Etiquetas ------------------------------ */

const TONOS_ESTADO: Record<string, string> = {
  Recibido: "bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  Procesando: "bg-cyan-50 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300",
  "Enviado Parcial":
    "bg-orange-50 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300",
  Enviado: "bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300",
  Completado:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Cancelado: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
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

/** Resume las remisiones en la única respuesta que importa en campo. */
function Despacho({
  remisiones,
  estado,
}: {
  remisiones: EntregaPedido[];
  estado: string | null;
}) {
  if (remisiones.length === 0) {
    const pendiente = !estaCerradoPedido(estado);
    return (
      <span
        className={
          pendiente
            ? "text-xs font-medium text-amber-700 dark:text-amber-300"
            : "text-xs text-slate-500 dark:text-slate-500"
        }
      >
        {pendiente ? "Sin despachar" : "Sin remisión"}
      </span>
    );
  }

  const recibida = remisiones.find((r) => r.recibido);
  if (recibida) {
    return (
      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
        Entregado {formatearFecha(recibida.recibido)}
      </span>
    );
  }

  const despachada = remisiones.find((r) => r.despachado);
  if (despachada) {
    return (
      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
        En camino desde {formatearFecha(despachada.despachado)}
      </span>
    );
  }

  return (
    <span className="text-xs text-slate-600 dark:text-slate-400">
      {remisiones.length}{" "}
      {remisiones.length === 1 ? "remisión" : "remisiones"}
    </span>
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
