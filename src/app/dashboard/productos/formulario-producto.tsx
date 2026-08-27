"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  AREAS_PRODUCTO,
  CATEGORIAS_CP_CN,
  CATEGORIAS_PRODUCTO,
  TIPOS_PRODUCTO,
  UNIDADES_PRODUCTO,
  type AreaProducto,
  type CategoriaCpCn,
  type CategoriaProducto,
  type TipoProducto,
  type UnidadProducto,
} from "@/lib/productos";
import { IconClose } from "../icons";

const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";
const etiqueta = "text-xs font-medium text-slate-700 dark:text-slate-300";

type Formulario = {
  nombre: string;
  abreviatura: string;
  categoria: CategoriaProducto;
  tipo: TipoProducto;
  unidad: UnidadProducto;
  categoriaCpCn: CategoriaCpCn | "";
  area: AreaProducto | "";
  version: string;
  precio: string;
  observaciones: string;
};

const VACIO: Formulario = {
  nombre: "",
  abreviatura: "",
  categoria: "Microbiología agrícola",
  tipo: "Bacteria",
  unidad: "L",
  categoriaCpCn: "",
  area: "",
  version: "",
  precio: "",
  observaciones: "",
};

export function FormularioProducto({ onCerrar }: { onCerrar: () => void }) {
  const router = useRouter();
  const dialogoRef = useRef<HTMLDivElement>(null);

  const [datos, setDatos] = useState<Formulario>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function actualizar(cambios: Partial<Formulario>) {
    setDatos((previos) => ({ ...previos, ...cambios }));
  }

  /* Atajos: Esc cierra, Ctrl+Enter guarda */
  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        onCerrar();
      }
      if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
        dialogoRef.current?.querySelector("form")?.requestSubmit();
      }
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();

    if (!datos.nombre.trim()) {
      setError("Escribe el nombre comercial del producto.");
      return;
    }
    if (datos.precio && Number(datos.precio) < 0) {
      setError("El precio no puede ser negativo.");
      return;
    }

    setGuardando(true);
    setError(null);

    const respuesta = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });

    setGuardando(false);

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos guardar el producto."));
      return;
    }

    router.refresh();
    onCerrar();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6">
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-producto"
        className="my-4 w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2
              id="titulo-producto"
              className="text-base font-semibold tracking-tight"
            >
              Nuevo producto
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Se guarda en la base Sirius Product Core · tabla Productos
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="cursor-pointer rounded-lg p-2 text-slate-600 transition-colors duration-200 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={guardar} className="px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="producto-nombre" className={etiqueta}>
                Nombre comercial
              </label>
              <input
                id="producto-nombre"
                required
                value={datos.nombre}
                onChange={(e) => actualizar({ nombre: e.target.value })}
                placeholder="Sirius Bacter"
                className={`${input} mt-1`}
              />
            </div>

            <div>
              <label htmlFor="producto-abreviatura" className={etiqueta}>
                Abreviatura{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <input
                id="producto-abreviatura"
                value={datos.abreviatura}
                onChange={(e) => actualizar({ abreviatura: e.target.value })}
                placeholder="SB"
                className={`${input} mt-1`}
              />
            </div>

            <div>
              <label htmlFor="producto-categoria" className={etiqueta}>
                Categoría
              </label>
              <select
                id="producto-categoria"
                value={datos.categoria}
                onChange={(e) =>
                  actualizar({ categoria: e.target.value as CategoriaProducto })
                }
                className={`${input} mt-1 cursor-pointer`}
              >
                {CATEGORIAS_PRODUCTO.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="producto-tipo" className={etiqueta}>
                Tipo
              </label>
              <select
                id="producto-tipo"
                value={datos.tipo}
                onChange={(e) =>
                  actualizar({ tipo: e.target.value as TipoProducto })
                }
                className={`${input} mt-1 cursor-pointer`}
              >
                {TIPOS_PRODUCTO.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="producto-unidad" className={etiqueta}>
                Unidad base
              </label>
              <select
                id="producto-unidad"
                value={datos.unidad}
                onChange={(e) =>
                  actualizar({ unidad: e.target.value as UnidadProducto })
                }
                className={`${input} mt-1 cursor-pointer`}
              >
                {UNIDADES_PRODUCTO.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="producto-precio" className={etiqueta}>
                Precio de venta{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <input
                id="producto-precio"
                type="number"
                min={0}
                step={100}
                value={datos.precio}
                onChange={(e) => actualizar({ precio: e.target.value })}
                placeholder="45000"
                className={`${input} mt-1 tabular-nums`}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                En pesos, por {datos.unidad}. Déjalo vacío si aún no tiene
                precio de lista.
              </p>
            </div>

            <div>
              <label htmlFor="producto-cpcn" className={etiqueta}>
                Clasificación CP/CN{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <select
                id="producto-cpcn"
                value={datos.categoriaCpCn}
                onChange={(e) =>
                  actualizar({
                    categoriaCpCn: e.target.value as CategoriaCpCn | "",
                  })
                }
                className={`${input} mt-1 cursor-pointer`}
              >
                <option value="">Sin clasificar</option>
                {CATEGORIAS_CP_CN.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="producto-area" className={etiqueta}>
                Área{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <select
                id="producto-area"
                value={datos.area}
                onChange={(e) =>
                  actualizar({ area: e.target.value as AreaProducto | "" })
                }
                className={`${input} mt-1 cursor-pointer`}
              >
                <option value="">Sin área</option>
                {AREAS_PRODUCTO.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="producto-version" className={etiqueta}>
                Versión{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <input
                id="producto-version"
                value={datos.version}
                onChange={(e) => actualizar({ version: e.target.value })}
                placeholder="v1.0"
                className={`${input} mt-1`}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="producto-observaciones" className={etiqueta}>
                Descripción{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <textarea
                id="producto-observaciones"
                rows={3}
                value={datos.observaciones}
                onChange={(e) => actualizar({ observaciones: e.target.value })}
                placeholder="Qué hace, en qué cultivos se usa y cómo se aplica…"
                className={`${input} mt-1 resize-y`}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                Es lo que el equipo lee para presentarlo en una visita.
              </p>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/15 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
            <button
              type="button"
              onClick={onCerrar}
              className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              {guardando ? "Guardando…" : "Guardar producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
