"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { Producto } from "@/lib/productos";
import {
  CATEGORIAS_PRODUCTO,
  formatearPrecio,
  TIPOS_PRODUCTO,
} from "@/lib/productos-comun";
import { IconFilter, IconPackage, IconPlus, IconSearch } from "../icons";
import { FormularioProducto } from "./formulario-producto";

const card =
  "tarjeta3d rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";
const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";

/** Un producto del catálogo más cuántas visitas lo mencionaron. */
export type FilaProducto = Producto & { visitas: number };

export function ModuloProductos({ filas }: { filas: FilaProducto[] }) {
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("activos");
  const [categoria, setCategoria] = useState("");
  const [tipo, setTipo] = useState("");

  const resumen = useMemo(() => {
    const activos = filas.filter((f) => f.activo);
    const conPrecio = activos.filter((f) => f.precio !== null);

    return {
      activos: activos.length,
      sinPrecio: activos.filter((f) => f.precio === null).length,
      conInteres: activos.filter((f) => f.visitas > 0).length,
      // Solo promedia lo que tiene precio: los "sin precio" no valen cero.
      promedio: conPrecio.length
        ? Math.round(
            conPrecio.reduce((suma, f) => suma + (f.precio ?? 0), 0) /
              conPrecio.length,
          )
        : null,
    };
  }, [filas]);

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return filas.filter((fila) => {
      const texto = [
        fila.nombre,
        fila.abreviatura ?? "",
        fila.codigo,
        fila.categoria ?? "",
        fila.tipo ?? "",
        fila.observaciones ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (termino && !texto.includes(termino)) return false;
      if (estado === "activos" && !fila.activo) return false;
      if (estado === "inactivos" && fila.activo) return false;
      if (estado === "sin-precio" && fila.precio !== null) return false;
      if (estado === "sin-interes" && fila.visitas > 0) return false;
      if (categoria && fila.categoria !== categoria) return false;
      if (tipo && fila.tipo !== tipo) return false;

      return true;
    });
  }, [filas, busqueda, estado, categoria, tipo]);

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            El catálogo comercial: qué vendes, a qué precio y en qué unidad.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFormularioAbierto(true)}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          <IconPlus className="h-4 w-4" />
          Nuevo producto
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Resumen titulo="Productos vigentes" valor={String(resumen.activos)} />
        <Resumen
          titulo="Precio promedio"
          valor={
            resumen.promedio === null
              ? "—"
              : formatearPrecio(resumen.promedio, null)
          }
        />
        <Resumen
          titulo="Sin precio asignado"
          valor={String(resumen.sinPrecio)}
          tono={resumen.sinPrecio > 0 ? "ambar" : undefined}
        />
        <Resumen
          titulo="Ofrecidos en alguna visita"
          valor={String(resumen.conInteres)}
        />
      </div>

      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1 lg:max-w-sm">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <label htmlFor="buscar-producto" className="sr-only">
              Buscar productos
            </label>
            <input
              id="buscar-producto"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, abreviatura, código o descripción…"
              className={`${input} pl-9`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            <IconFilter className="h-4 w-4 text-slate-500 dark:text-slate-400" />

            <label htmlFor="filtro-estado-producto" className="sr-only">
              Estado del producto
            </label>
            <select
              id="filtro-estado-producto"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className={`${input} w-auto cursor-pointer`}
            >
              <option value="activos">Vigentes</option>
              <option value="sin-precio">Sin precio</option>
              <option value="sin-interes">Sin interés registrado</option>
              <option value="inactivos">Descontinuados</option>
              <option value="todos">Todos</option>
            </select>

            <label htmlFor="filtro-categoria-producto" className="sr-only">
              Categoría
            </label>
            <select
              id="filtro-categoria-producto"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className={`${input} w-auto max-w-52 cursor-pointer`}
            >
              <option value="">Toda categoría</option>
              {CATEGORIAS_PRODUCTO.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>

            <label htmlFor="filtro-tipo-producto" className="sr-only">
              Tipo
            </label>
            <select
              id="filtro-tipo-producto"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={`${input} w-auto cursor-pointer`}
            >
              <option value="">Todo tipo</option>
              {TIPOS_PRODUCTO.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <div className="mt-8 pb-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filas.length === 0
                ? "Todavía no hay productos en Sirius Product Core."
                : "Ningún producto coincide con estos filtros."}
            </p>
            {filas.length === 0 ? (
              <button
                type="button"
                onClick={() => setFormularioAbierto(true)}
                className="mt-4 cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
              >
                Crear el primer producto
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-500">
              {filtradas.length}{" "}
              {filtradas.length === 1 ? "producto" : "productos"} · el precio se
              ajusta desde la misma fila
            </p>

            <div className="-mx-5 mt-2 overflow-x-auto">
              <table className="w-full min-w-[64rem] text-sm">
                <thead>
                  <tr className="border-y border-slate-200 text-left text-xs tracking-wide text-slate-600 uppercase dark:border-white/10 dark:text-slate-400">
                    {[
                      "Producto",
                      "Clasificación",
                      "Precio",
                      "Interés",
                      "Estado",
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
                  {filtradas.map((fila) => (
                    <Fila key={fila.recordId} fila={fila} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {formularioAbierto ? (
        <FormularioProducto onCerrar={() => setFormularioAbierto(false)} />
      ) : null}
    </div>
  );
}

function Fila({ fila }: { fila: FilaProducto }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const [precio, setPrecio] = useState(
    fila.precio === null ? "" : String(fila.precio),
  );
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(cuerpo: Record<string, unknown>) {
    setOcupado(true);
    setError(null);

    const respuesta = await fetch(`/api/productos/${fila.recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

    setOcupado(false);

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos actualizar el producto."));
      return;
    }

    setEditando(false);
    router.refresh();
  }

  const detalleId = `detalle-${fila.recordId}`;

  return (
    <>
      <tr className="align-top transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-white/5">
        <td className="px-5 py-3">
          <p className="font-medium">{fila.nombre}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {fila.abreviatura ?? "sin abreviatura"}
            {fila.version ? ` · ${fila.version}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 tabular-nums dark:text-slate-500">
            {fila.codigo}
          </p>
          {error ? (
            <p
              role="alert"
              className="mt-1 text-xs font-medium text-red-700 dark:text-red-400"
            >
              {error}
            </p>
          ) : null}
        </td>

        <td className="px-5 py-3">
          <p>{fila.categoria ?? "—"}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {[fila.tipo, fila.area].filter(Boolean).join(" · ") || "—"}
          </p>
          {fila.categoriaCpCn && fila.categoriaCpCn !== "N/A" ? (
            <span className="mt-1 inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
              {fila.categoriaCpCn}
            </span>
          ) : null}
        </td>

        <td className="px-5 py-3 whitespace-nowrap">
          {editando ? (
            <>
              <label htmlFor={`precio-${fila.recordId}`} className="sr-only">
                Precio de {fila.nombre}
              </label>
              <input
                id={`precio-${fila.recordId}`}
                type="number"
                min={0}
                step={100}
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="sin precio"
                disabled={ocupado}
                className={`${input} w-32 tabular-nums`}
              />
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-500">
                por {fila.unidad ?? "unidad"}
              </span>
            </>
          ) : (
            <>
              <span className="tabular-nums">
                {formatearPrecio(fila.precio, fila.unidad)}
              </span>
              {fila.precio === null ? (
                <span className="mt-1 block">
                  <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    sin precio
                  </span>
                </span>
              ) : null}
            </>
          )}
        </td>

        <td className="px-5 py-3 tabular-nums">
          {fila.visitas === 0 ? (
            <span className="text-slate-500 dark:text-slate-500">—</span>
          ) : (
            <span title={`Mencionado en ${fila.visitas} visitas`}>
              {fila.visitas}
            </span>
          )}
        </td>

        <td className="px-5 py-3">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
              fila.activo
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
            }`}
          >
            {fila.activo ? "Vigente" : "Descontinuado"}
          </span>
        </td>

        <td className="px-5 py-3 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {editando ? (
              <>
                <Accion
                  onClick={() => enviar({ accion: "precio", precio })}
                  disabled={ocupado}
                  destacada
                >
                  Guardar
                </Accion>
                <Accion
                  onClick={() => {
                    setPrecio(fila.precio === null ? "" : String(fila.precio));
                    setError(null);
                    setEditando(false);
                  }}
                  disabled={ocupado}
                >
                  Cancelar
                </Accion>
              </>
            ) : (
              <>
                <Accion onClick={() => setEditando(true)} disabled={ocupado}>
                  Precio
                </Accion>
                <Accion
                  onClick={() =>
                    enviar({ accion: "estado", activo: !fila.activo })
                  }
                  disabled={ocupado}
                >
                  {fila.activo ? "Descontinuar" : "Reactivar"}
                </Accion>
                {fila.observaciones ? (
                  <button
                    type="button"
                    onClick={() => setAbierta((v) => !v)}
                    aria-expanded={abierta}
                    aria-controls={detalleId}
                    className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:border-white/10 dark:hover:bg-white/10"
                  >
                    {abierta ? "Cerrar" : "Ficha"}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </td>
      </tr>

      {abierta && fila.observaciones ? (
        <tr id={detalleId} className="bg-slate-50 dark:bg-white/5">
          <td colSpan={6} className="px-5 py-4">
            <p className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <IconPackage className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
              <span>{fila.observaciones}</span>
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Accion({
  onClick,
  disabled,
  destacada,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  destacada?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-50 ${
        destacada
          ? "bg-blue-700 text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          : "border border-slate-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
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
    <div className={`${card} p-5`}>
      <p className="text-sm text-slate-600 dark:text-slate-400">{titulo}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tono === "ambar"
            ? "text-amber-700 dark:text-amber-400"
            : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
