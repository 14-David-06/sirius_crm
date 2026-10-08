"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { ClienteCore } from "@/lib/clientes";
import { codigosDelCatalogo } from "@/lib/productos-comun";
import type { Proyecto } from "@/lib/proyectos";
import { IconClose } from "../icons";
import {
  botonPrimario,
  botonSecundario,
  etiqueta,
  input,
  type CultivoOpcion,
  type PersonaOpcion,
  type ProductoOpcion,
} from "./comun";

type Formulario = {
  clienteId: string;
  nombre: string;
  cultivo: string;
  ubicacion: string;
  productos: string[];
  objetivo: string;
  metodologia: string;
  indicadores: string;
  fechaInicio: string;
  fechaFinPlaneada: string;
  estado: "Planeación" | "En ejecución";
  liderId: string;
  observaciones: string;
};

function vacio(hoy: string, liderId: string): Formulario {
  return {
    clienteId: "",
    nombre: "",
    cultivo: "",
    ubicacion: "",
    productos: [],
    objetivo: "",
    metodologia: "",
    indicadores: "",
    fechaInicio: hoy,
    fechaFinPlaneada: "",
    estado: "Planeación",
    liderId,
    observaciones: "",
  };
}

function desdeProyecto(
  proyecto: Proyecto,
  clientes: ClienteCore[],
  productos: ProductoOpcion[],
  hoy: string,
): Formulario {
  return {
    ...vacio(hoy, proyecto.idPersonalCore ?? ""),
    clienteId:
      clientes.find((c) => c.id === proyecto.idClienteCore)?.recordId ?? "",
    nombre: proyecto.nombre,
    cultivo: proyecto.cultivo ?? "",
    ubicacion: proyecto.ubicacion ?? "",
    productos: codigosDelCatalogo(proyecto.idProductosCore, productos),
    objetivo: proyecto.objetivo ?? "",
    metodologia: proyecto.metodologia ?? "",
    indicadores: proyecto.indicadores ?? "",
    fechaInicio: proyecto.fechaInicio ?? "",
    fechaFinPlaneada: proyecto.fechaFinPlaneada ?? "",
    observaciones: proyecto.observaciones ?? "",
  };
}

export function FormularioProyecto({
  clientes,
  productos,
  cultivos,
  personal,
  proyecto,
  sesion,
  puedeElegirLider,
  hoy,
  onCerrar,
}: {
  clientes: ClienteCore[];
  /** Catálogo completo: un producto descontinuado sigue en las pruebas viejas. */
  productos: ProductoOpcion[];
  cultivos: CultivoOpcion[];
  personal: PersonaOpcion[];
  /** Presente al editar; ausente al crear. */
  proyecto?: Proyecto;
  sesion: { idEmpleado: string; nombre: string };
  puedeElegirLider: boolean;
  hoy: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const dialogoRef = useRef<HTMLDivElement>(null);
  const editando = Boolean(proyecto);

  const [datos, setDatos] = useState<Formulario>(() =>
    proyecto
      ? desdeProyecto(proyecto, clientes, productos, hoy)
      : vacio(hoy, sesion.idEmpleado),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cliente = clientes.find((c) => c.recordId === datos.clienteId);
  const cultivosDelCliente = [
    ...new Set(
      cultivos
        .filter((c) => c.clientes.includes(datos.clienteId))
        .map((c) => c.nombre),
    ),
  ];
  const productosOfrecidos = productos.filter(
    (p) => p.activo || datos.productos.includes(p.codigo),
  );

  function actualizar(cambios: Partial<Formulario>) {
    setDatos((previos) => ({ ...previos, ...cambios }));
  }

  function alternarProducto(codigo: string) {
    actualizar({
      productos: datos.productos.includes(codigo)
        ? datos.productos.filter((c) => c !== codigo)
        : [...datos.productos, codigo],
    });
  }

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCerrar();
      if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
        dialogoRef.current?.querySelector("form")?.requestSubmit();
      }
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();

    if (!editando && !cliente) {
      setError("Elige el cliente con el que se hace la prueba.");
      return;
    }
    if (!datos.nombre.trim()) {
      setError("Ponle un nombre al proyecto.");
      return;
    }
    if (!datos.objetivo.trim()) {
      setError("Escribe el objetivo de la prueba.");
      return;
    }
    if (
      datos.fechaInicio &&
      datos.fechaFinPlaneada &&
      datos.fechaFinPlaneada < datos.fechaInicio
    ) {
      setError("La fecha de fin no puede ser anterior al inicio.");
      return;
    }

    setGuardando(true);
    setError(null);

    const comunes = {
      nombre: datos.nombre,
      cultivo: datos.cultivo,
      ubicacion: datos.ubicacion,
      productos: datos.productos,
      objetivo: datos.objetivo,
      metodologia: datos.metodologia,
      indicadores: datos.indicadores,
      fechaInicio: datos.fechaInicio,
      fechaFinPlaneada: datos.fechaFinPlaneada,
      observaciones: datos.observaciones,
      liderId: datos.liderId,
    };

    const respuesta = proyecto
      ? await fetch(`/api/proyectos/${proyecto.recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "datos", ...comunes }),
        })
      : await fetch("/api/proyectos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...comunes,
            idClienteCore: cliente?.id,
            cliente: cliente?.nombre,
            estado: datos.estado,
          }),
        });

    setGuardando(false);

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos guardar el proyecto."));
      return;
    }

    const data = await respuesta.json().catch(() => ({}));
    onCerrar();
    // Al crear se abre la ficha: lo siguiente es armar el cronograma.
    if (!proyecto && data.proyecto?.recordId) {
      router.push(`/dashboard/proyectos/${data.proyecto.recordId}`);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6">
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-proyecto"
        className="my-4 w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <h2
            id="titulo-proyecto"
            className="text-base font-semibold tracking-tight"
          >
            {editando ? `Editar ${proyecto?.id ?? "proyecto"}` : "Nuevo proyecto"}
          </h2>
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
            <div className="sm:col-span-2">
              <label htmlFor="pry-nombre" className={etiqueta}>
                Nombre
              </label>
              <input
                id="pry-nombre"
                required
                value={datos.nombre}
                onChange={(e) => actualizar({ nombre: e.target.value })}
                placeholder="Bioestimulante en floración — lote 4"
                className={`${input} mt-1`}
              />
            </div>

            <div>
              <label htmlFor="pry-cliente" className={etiqueta}>
                Cliente
              </label>
              {editando ? (
                <p
                  id="pry-cliente"
                  className={`${input} mt-1 bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400`}
                >
                  {proyecto?.cliente}
                </p>
              ) : (
                <select
                  id="pry-cliente"
                  required
                  value={datos.clienteId}
                  onChange={(e) =>
                    actualizar({ clienteId: e.target.value, cultivo: "" })
                  }
                  className={`${input} mt-1 cursor-pointer`}
                >
                  <option value="">Elige un cliente…</option>
                  {clientes.map((c) => (
                    <option key={c.recordId} value={c.recordId}>
                      {c.nombre}
                      {c.ciudad ? ` — ${c.ciudad}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="pry-lider" className={etiqueta}>
                Líder
              </label>
              {puedeElegirLider ? (
                <select
                  id="pry-lider"
                  value={datos.liderId}
                  onChange={(e) => actualizar({ liderId: e.target.value })}
                  className={`${input} mt-1 cursor-pointer`}
                >
                  {personal.map((p) => (
                    <option key={p.idEmpleado} value={p.idEmpleado}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              ) : (
                <p
                  id="pry-lider"
                  className={`${input} mt-1 bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400`}
                >
                  {proyecto?.responsable ?? sesion.nombre}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="pry-cultivo" className={etiqueta}>
                Cultivo
              </label>
              <input
                id="pry-cultivo"
                list="pry-cultivos"
                value={datos.cultivo}
                onChange={(e) => actualizar({ cultivo: e.target.value })}
                placeholder="Palma, aguacate, café…"
                className={`${input} mt-1`}
              />
              <datalist id="pry-cultivos">
                {cultivosDelCliente.map((nombre) => (
                  <option key={nombre} value={nombre} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="pry-ubicacion" className={etiqueta}>
                Ubicación
              </label>
              <input
                id="pry-ubicacion"
                value={datos.ubicacion}
                onChange={(e) => actualizar({ ubicacion: e.target.value })}
                placeholder="Finca, lote o sector"
                className={`${input} mt-1`}
              />
            </div>

            <fieldset className="sm:col-span-2">
              <legend className={etiqueta}>
                Productos evaluados
                {datos.productos.length > 0
                  ? ` (${datos.productos.length})`
                  : ""}
              </legend>
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">
                {productosOfrecidos.length === 0 ? (
                  <p className="p-2 text-sm text-slate-600 dark:text-slate-400">
                    No hay productos activos en Sirius Product Core.
                  </p>
                ) : (
                  productosOfrecidos.map((producto) => (
                    <label
                      key={producto.codigo}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={datos.productos.includes(producto.codigo)}
                        onChange={() => alternarProducto(producto.codigo)}
                        className="h-4 w-4 cursor-pointer accent-blue-700 dark:accent-blue-500"
                      />
                      <span className="flex-1">
                        {producto.nombre}
                        {producto.activo ? null : (
                          <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                            descontinuado
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {producto.codigo}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>

            <div className="sm:col-span-2">
              <label htmlFor="pry-objetivo" className={etiqueta}>
                Objetivo
              </label>
              <textarea
                id="pry-objetivo"
                required
                rows={3}
                value={datos.objetivo}
                onChange={(e) => actualizar({ objetivo: e.target.value })}
                placeholder="Qué se quiere demostrar con la prueba"
                className={`${input} mt-1 resize-y`}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="pry-metodologia" className={etiqueta}>
                Metodología{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <textarea
                id="pry-metodologia"
                rows={3}
                value={datos.metodologia}
                onChange={(e) => actualizar({ metodologia: e.target.value })}
                placeholder="Tratamientos, testigo, dosis, área, frecuencia de aplicación"
                className={`${input} mt-1 resize-y`}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="pry-indicadores" className={etiqueta}>
                Indicadores{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <textarea
                id="pry-indicadores"
                rows={2}
                value={datos.indicadores}
                onChange={(e) => actualizar({ indicadores: e.target.value })}
                placeholder="Rendimiento por hectárea, incidencia de la plaga, peso del racimo…"
                className={`${input} mt-1 resize-y`}
              />
            </div>

            <div>
              <label htmlFor="pry-inicio" className={etiqueta}>
                Fecha de inicio
              </label>
              <input
                id="pry-inicio"
                type="date"
                value={datos.fechaInicio}
                onChange={(e) => actualizar({ fechaInicio: e.target.value })}
                className={`${input} mt-1`}
              />
            </div>

            <div>
              <label htmlFor="pry-fin" className={etiqueta}>
                Fecha de fin planeada
              </label>
              <input
                id="pry-fin"
                type="date"
                min={datos.fechaInicio || undefined}
                value={datos.fechaFinPlaneada}
                onChange={(e) =>
                  actualizar({ fechaFinPlaneada: e.target.value })
                }
                className={`${input} mt-1`}
              />
            </div>

            {editando ? null : (
              <div>
                <label htmlFor="pry-estado" className={etiqueta}>
                  Estado inicial
                </label>
                <select
                  id="pry-estado"
                  value={datos.estado}
                  onChange={(e) =>
                    actualizar({
                      estado: e.target.value as Formulario["estado"],
                    })
                  }
                  className={`${input} mt-1 cursor-pointer`}
                >
                  <option value="Planeación">Planeación</option>
                  <option value="En ejecución">En ejecución</option>
                </select>
              </div>
            )}

            <div className="sm:col-span-2">
              <label htmlFor="pry-observaciones" className={etiqueta}>
                Observaciones{" "}
                <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <textarea
                id="pry-observaciones"
                rows={2}
                value={datos.observaciones}
                onChange={(e) => actualizar({ observaciones: e.target.value })}
                className={`${input} mt-1 resize-y`}
              />
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
            <button type="button" onClick={onCerrar} className={botonSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className={botonPrimario}>
              {guardando
                ? "Guardando…"
                : editando
                  ? "Guardar cambios"
                  : "Crear proyecto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
