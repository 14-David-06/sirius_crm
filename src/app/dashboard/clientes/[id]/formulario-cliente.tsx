"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CANAL_OTRO, CANALES_CONOCIMIENTO } from "@/lib/clientes-comun";
import { IconClose } from "../../icons";

const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";
const etiqueta = "text-xs font-medium text-slate-700 dark:text-slate-300";

/** Todo lo que la ficha deja corregir; el resto del cliente es de solo lectura. */
export type DatosCliente = {
  recordId: string;
  nombre: string;
  nit: string | null;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  coordenadas: string | null;
  distanciaBodegaKm: number | null;
  sector: string | null;
  segmento: string | null;
  etapa: string | null;
  responsableComercial: string | null;
  vinculacion: string | null;
  observaciones: string | null;
  comoConocio: string | null;
  comoConocioDetalle: string | null;
};

type Formulario = Omit<DatosCliente, "recordId" | "distanciaBodegaKm"> & {
  distanciaBodegaKm: string;
};

function desdeCliente(cliente: DatosCliente): Formulario {
  return {
    nombre: cliente.nombre,
    nit: cliente.nit ?? "",
    direccion: cliente.direccion ?? "",
    ciudad: cliente.ciudad ?? "",
    departamento: cliente.departamento ?? "",
    coordenadas: cliente.coordenadas ?? "",
    distanciaBodegaKm:
      cliente.distanciaBodegaKm === null ? "" : String(cliente.distanciaBodegaKm),
    sector: cliente.sector ?? "",
    segmento: cliente.segmento ?? "",
    etapa: cliente.etapa ?? "",
    responsableComercial: cliente.responsableComercial ?? "",
    // El campo de Airtable es date; el input necesita el día suelto.
    vinculacion: cliente.vinculacion?.slice(0, 10) ?? "",
    observaciones: cliente.observaciones ?? "",
    comoConocio: cliente.comoConocio ?? "",
    comoConocioDetalle: cliente.comoConocioDetalle ?? "",
  };
}

export function FormularioCliente({
  cliente,
  onCerrar,
}: {
  cliente: DatosCliente;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const dialogoRef = useRef<HTMLDivElement>(null);

  const [datos, setDatos] = useState<Formulario>(desdeCliente(cliente));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esOtro = datos.comoConocio === CANAL_OTRO;

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
      setError("El nombre del cliente es obligatorio.");
      return;
    }
    if (esOtro && !datos.comoConocioDetalle?.trim()) {
      setError("Elegiste «Otro»: escribe por qué medio nos conoció.");
      return;
    }

    setGuardando(true);
    setError(null);

    const respuesta = await fetch(`/api/clientes/${cliente.recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "datos",
        ...datos,
        // Con cualquier otro canal el detalle no se guarda.
        comoConocioDetalle: esOtro ? datos.comoConocioDetalle : "",
      }),
    });

    setGuardando(false);

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos guardar el cliente."));
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
        aria-labelledby="titulo-cliente"
        className="my-4 w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2
              id="titulo-cliente"
              className="text-base font-semibold tracking-tight"
            >
              Editar cliente
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Se guarda en la base Sirius Clients Core · tabla Clientes
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-white/10"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={guardar} className="px-5 py-4">
          <Grupo titulo="Identificación">
            <Campo
              id="cliente-nombre"
              etiqueta="Nombre del cliente"
              obligatorio
              valor={datos.nombre}
              onCambio={(nombre) => actualizar({ nombre })}
            />
            <Campo
              id="cliente-nit"
              etiqueta="NIT"
              valor={datos.nit ?? ""}
              onCambio={(nit) => actualizar({ nit })}
            />
          </Grupo>

          <Grupo titulo="Ubicación">
            <Campo
              id="cliente-direccion"
              etiqueta="Dirección"
              valor={datos.direccion ?? ""}
              onCambio={(direccion) => actualizar({ direccion })}
            />
            <Campo
              id="cliente-ciudad"
              etiqueta="Ciudad"
              valor={datos.ciudad ?? ""}
              onCambio={(ciudad) => actualizar({ ciudad })}
            />
            <Campo
              id="cliente-departamento"
              etiqueta="Departamento"
              valor={datos.departamento ?? ""}
              onCambio={(departamento) => actualizar({ departamento })}
            />
            <Campo
              id="cliente-coordenadas"
              etiqueta="Coordenadas GPS"
              ayuda="Latitud, longitud. Se abre en Google Maps desde la ficha."
              valor={datos.coordenadas ?? ""}
              onCambio={(coordenadas) => actualizar({ coordenadas })}
            />
            <Campo
              id="cliente-distancia"
              etiqueta="Distancia a bodega (km)"
              tipo="number"
              valor={datos.distanciaBodegaKm}
              onCambio={(distanciaBodegaKm) =>
                actualizar({ distanciaBodegaKm })
              }
            />
          </Grupo>

          <Grupo titulo="Información comercial">
            <div>
              <label htmlFor="cliente-canal" className={etiqueta}>
                ¿Cómo conoció a Sirius?
              </label>
              <select
                id="cliente-canal"
                value={datos.comoConocio ?? ""}
                onChange={(e) =>
                  actualizar({
                    comoConocio: e.target.value,
                    // Cambiar de canal borra el detalle: pertenecía a "Otro".
                    comoConocioDetalle:
                      e.target.value === CANAL_OTRO
                        ? datos.comoConocioDetalle
                        : "",
                  })
                }
                className={`${input} mt-1 cursor-pointer`}
              >
                <option value="">Sin registrar</option>
                {CANALES_CONOCIMIENTO.map((canal) => (
                  <option key={canal} value={canal}>
                    {canal}
                  </option>
                ))}
              </select>
            </div>

            {esOtro ? (
              <Campo
                id="cliente-canal-detalle"
                etiqueta="¿Cuál?"
                obligatorio
                ayuda="Solo aplica cuando el canal es «Otro»."
                valor={datos.comoConocioDetalle ?? ""}
                onCambio={(comoConocioDetalle) =>
                  actualizar({ comoConocioDetalle })
                }
              />
            ) : null}

            <Campo
              id="cliente-sector"
              etiqueta="Sector o cultivo"
              valor={datos.sector ?? ""}
              onCambio={(sector) => actualizar({ sector })}
            />
            <Campo
              id="cliente-segmento"
              etiqueta="Segmento (potencial)"
              valor={datos.segmento ?? ""}
              onCambio={(segmento) => actualizar({ segmento })}
            />
            <Campo
              id="cliente-etapa"
              etiqueta="Etapa comercial"
              valor={datos.etapa ?? ""}
              onCambio={(etapa) => actualizar({ etapa })}
            />
            <Campo
              id="cliente-responsable"
              etiqueta="Responsable comercial"
              valor={datos.responsableComercial ?? ""}
              onCambio={(responsableComercial) =>
                actualizar({ responsableComercial })
              }
            />
            <Campo
              id="cliente-vinculacion"
              etiqueta="Fecha de vinculación"
              tipo="date"
              valor={datos.vinculacion ?? ""}
              onCambio={(vinculacion) => actualizar({ vinculacion })}
            />
          </Grupo>

          <div className="mt-5">
            <label htmlFor="cliente-observaciones" className={etiqueta}>
              Observaciones
            </label>
            <textarea
              id="cliente-observaciones"
              rows={3}
              value={datos.observaciones ?? ""}
              onChange={(e) => actualizar({ observaciones: e.target.value })}
              className={`${input} mt-1 resize-y`}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-500/15 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
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
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Grupo({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="mt-5 first:mt-0">
      <legend className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500">
        {titulo}
      </legend>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Campo({
  id,
  etiqueta: texto,
  valor,
  onCambio,
  tipo = "text",
  obligatorio = false,
  ayuda,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambio: (valor: string) => void;
  tipo?: "text" | "number" | "date";
  obligatorio?: boolean;
  ayuda?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={etiqueta}>
        {texto}
        {obligatorio ? null : (
          <span className="font-normal text-slate-500"> (opcional)</span>
        )}
      </label>
      <input
        id={id}
        type={tipo}
        required={obligatorio}
        min={tipo === "number" ? 0 : undefined}
        step={tipo === "number" ? "any" : undefined}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className={`${input} mt-1`}
      />
      {ayuda ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}
