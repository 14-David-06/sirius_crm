"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { interpretarDictado, sumarDias } from "@/lib/dictado";
import type { ClienteCore } from "@/lib/clientes";
import type { Visita } from "@/lib/crm";
import { RESULTADOS_VISITA, TIPOS_VISITA } from "@/lib/crm-comun";
import type { Producto } from "@/lib/productos";
import { codigosDelCatalogo } from "@/lib/productos-comun";
import { IconClose } from "../icons";
import { Microfono } from "./microfono";
import type { ContactoVisita } from "./modulo";

const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";
const etiquetaClase = "text-sm font-medium text-slate-800 dark:text-slate-200";

const CLAVE_BORRADOR = "sirius-crm:borrador-visita";

const ATAJOS_FECHA = [
  { texto: "+3 días", dias: 3 },
  { texto: "+1 semana", dias: 7 },
  { texto: "+15 días", dias: 15 },
  { texto: "+1 mes", dias: 30 },
];

const OBJETIVOS_FRECUENTES = [
  "Presentar la línea de bioinsumos",
  "Revisar resultados de la prueba en campo",
  "Seguimiento a cotización enviada",
  "Diagnóstico agronómico del lote",
  "Cierre de negociación",
];

type Formulario = {
  clienteId: string;
  /** Codigo Persona Cliente del contacto; "" cuando no se anotó ninguno. */
  contactoCodigo: string;
  fecha: string;
  responsableId: string;
  tipo: string;
  objetivo: string;
  necesidad: string;
  seleccionados: string[];
  resultado: string;
  proximaAccion: string;
  fechaSeguimiento: string;
  pendientes: string;
  observaciones: string;
};

export function FormularioVisita({
  clientes,
  contactos,
  productos,
  personal,
  visitas,
  visita,
  sesion,
  hoy,
  transcripcionDisponible,
  onCerrar,
}: {
  clientes: ClienteCore[];
  contactos: ContactoVisita[];
  productos: Producto[];
  personal: { nombre: string; rol: string | null; idEmpleado: string }[];
  visitas: Visita[];
  /** Presente al corregir una visita ya registrada; ausente al crear una. */
  visita?: Visita;
  sesion: { idEmpleado: string; nombre: string };
  hoy: string;
  transcripcionDisponible: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const { idEmpleado, nombre: usuario } = sesion;
  const editando = Boolean(visita);

  const inicial: Formulario = {
    clienteId: "",
    contactoCodigo: "",
    fecha: hoy,
    // Arranca en la propia sesión: si quedara vacío, el select mostraría a
    // otra persona mientras el estado dice "".
    responsableId: idEmpleado,
    tipo: "Presencial",
    objetivo: "",
    necesidad: "",
    seleccionados: [],
    resultado: "Seguimiento pendiente",
    proximaAccion: "",
    fechaSeguimiento: "",
    pendientes: "",
    observaciones: "",
  };

  // El borrador se lee una sola vez, al construir el estado, para no
  // disparar un render en cascada desde un efecto. Al editar no se lee: un
  // borrador a medias pisaría los datos de una visita que ya existe.
  const [borrador] = useState(() => (visita ? null : leerBorrador(inicial)));

  const [datos, setDatos] = useState<Formulario>(() => {
    if (visita) return desdeVisita(visita, inicial, productos, clientes);
    return borrador
      ? { ...inicial, ...borrador, responsableId: idEmpleado }
      : inicial;
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [interpretado, setInterpretado] = useState<string[] | null>(null);
  const [borradorRestaurado, setBorradorRestaurado] = useState(
    Boolean(borrador),
  );

  const dialogoRef = useRef<HTMLDivElement>(null);

  const cliente = clientes.find((c) => c.recordId === datos.clienteId);

  /**
   * `productos` llega con el catálogo completo, descontinuados incluidos, para
   * poder conservar los que una visita vieja ya referencia. Lo que se *ofrece*
   * son los vigentes, más el descontinuado que ya estuviera marcado: sin eso,
   * corregir cualquier otro campo lo borraría del registro histórico.
   */
  const productosActivos = productos.filter((producto) => producto.activo);
  const productosOfrecidos = productos.filter(
    (producto) =>
      producto.activo || datos.seleccionados.includes(producto.codigo),
  );

  // El dictado y el vocabulario de Whisper solo miran los vigentes: nadie
  // debería poder dictar un producto descontinuado en una visita nueva.
  const vocabulario = productosActivos.map((p) => p.nombre);

  /**
   * Los contactos del cliente. Se ofrece un inactivo solo si es el que la
   * visita ya tenía: de lo contrario, corregir cualquier otro campo de una
   * visita vieja borraría al contacto en silencio.
   */
  const contactosDelCliente = contactos.filter(
    (contacto) =>
      // El contacto ya anotado siempre se ofrece, aunque esté inactivo o su
      // cliente no esté en el selector: si no, corregir cualquier otro campo
      // de una visita vieja lo borraría en silencio.
      contacto.codigo === datos.contactoCodigo ||
      (contacto.activo && contacto.clientes.includes(datos.clienteId)),
  );

  const ultimaVisita = cliente
    ? visitas.find((visita) => visita.cliente === cliente.nombre)
    : undefined;

  function actualizar(cambios: Partial<Formulario>) {
    setDatos((previos) => ({ ...previos, ...cambios }));
  }

  /* Borrador: guardar mientras se escribe. Solo al registrar: el borrador de
     un alta no tiene nada que ver con la corrección de una visita existente. */
  useEffect(() => {
    if (editando) return;
    try {
      window.localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(datos));
    } catch {
      // Sin localStorage (modo privado) el formulario sigue funcionando.
    }
  }, [datos, editando]);

  /* Atajos: Esc cierra, Ctrl+Enter guarda */
  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        onCerrar();
      }
      if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
        evento.preventDefault();
        dialogoRef.current?.querySelector("form")?.requestSubmit();
      }
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  /** Reparte un dictado libre en los campos del formulario. */
  function aplicarDictado(texto: string) {
    const lectura = interpretarDictado(texto, {
      productos: productosActivos.map((p) => ({
        codigo: p.codigo,
        nombre: p.nombre,
      })),
      clientes: clientes.map((c) => c.nombre),
      // Todos los contactos activos: el cliente puede detectarse en el mismo
      // dictado, así que todavía no se sabe por cuál filtrar.
      contactos: contactos.filter((c) => c.activo).map((c) => c.nombre),
      hoy,
    });

    const cambios: Partial<Formulario> = {};
    const detectado: string[] = [];

    if (lectura.cliente) {
      const encontrado = clientes.find((c) => c.nombre === lectura.cliente);
      if (encontrado) {
        cambios.clienteId = encontrado.recordId;
        detectado.push(`cliente: ${encontrado.nombre}`);
      }
    }
    if (lectura.tipo) {
      cambios.tipo = lectura.tipo;
      detectado.push(`tipo: ${lectura.tipo}`);
    }
    if (lectura.contacto) {
      // Solo vale si pertenece al cliente que quedó elegido: un homónimo de
      // otra empresa sería peor que no anotar contacto.
      const delCliente = cambios.clienteId ?? datos.clienteId;
      const encontrado = contactos.find(
        (contacto) =>
          contacto.nombre === lectura.contacto &&
          contacto.clientes.includes(delCliente),
      );
      if (encontrado) {
        cambios.contactoCodigo = encontrado.codigo;
        detectado.push(`contacto: ${encontrado.nombre}`);
      }
    }
    if (lectura.resultado) {
      cambios.resultado = lectura.resultado;
      detectado.push(`resultado: ${lectura.resultado}`);
    }
    if (lectura.fechaSeguimiento) {
      cambios.fechaSeguimiento = lectura.fechaSeguimiento;
      detectado.push(`seguimiento: ${lectura.fechaSeguimiento}`);
    }
    if (lectura.productos.length > 0) {
      cambios.seleccionados = lectura.productos;
      const nombres = productosActivos
        .filter((p) => lectura.productos.includes(p.codigo))
        .map((p) => p.nombre);
      detectado.push(`productos: ${nombres.join(", ")}`);
    }

    cambios.objetivo = unir(datos.objetivo, lectura.objetivo);
    if (lectura.necesidad) {
      cambios.necesidad = unir(datos.necesidad, lectura.necesidad);
    }
    if (lectura.proximaAccion) {
      cambios.proximaAccion = unir(datos.proximaAccion, lectura.proximaAccion);
    }
    if (lectura.pendientes) {
      cambios.pendientes = unir(datos.pendientes, lectura.pendientes);
      detectado.push("pendientes");
    }
    if (lectura.observaciones) {
      cambios.observaciones = unir(datos.observaciones, lectura.observaciones);
      detectado.push("observaciones");
    }

    actualizar(cambios);
    setInterpretado(detectado);
  }

  function alternarProducto(codigo: string) {
    setDatos((previos) => ({
      ...previos,
      seleccionados: previos.seleccionados.includes(codigo)
        ? previos.seleccionados.filter((c) => c !== codigo)
        : [...previos.seleccionados, codigo],
    }));
  }

  function limpiar() {
    setDatos({ ...inicial, fecha: hoy, responsableId: idEmpleado });
    setInterpretado(null);
    setBorradorRestaurado(false);
    try {
      window.localStorage.removeItem(CLAVE_BORRADOR);
    } catch {
      // sin localStorage no hay nada que limpiar
    }
  }

  async function enviar(evento: React.FormEvent, seguirRegistrando = false) {
    evento.preventDefault();

    // Al editar, el cliente no se toca: viene del registro y no está en el
    // formulario, así que no hay nada que exigir aquí.
    if (!editando && !cliente) {
      setError("Elige un cliente de la lista.");
      return;
    }

    const elegidos = productos.filter((p) =>
      datos.seleccionados.includes(p.codigo),
    );

    const comunes = {
      idContactoCore: datos.contactoCodigo,
      fecha: datos.fecha,
      tipo: datos.tipo,
      objetivo: datos.objetivo,
      necesidad: datos.necesidad,
      idProductosCore: elegidos.map((p) => p.codigo).join(", "),
      productos: elegidos.map((p) => p.nombre).join(", "),
      resultado: datos.resultado,
      proximaAccion: datos.proximaAccion,
      fechaSeguimiento: datos.fechaSeguimiento,
      pendientes: datos.pendientes,
      observaciones: datos.observaciones,
    };

    setGuardando(true);
    setError(null);

    const respuesta = visita
      ? await fetch(`/api/visitas/${visita.recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(comunes),
        })
      : await fetch("/api/visitas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...comunes,
            idClienteCore: cliente?.id,
            cliente: cliente?.nombre,
            responsableId: datos.responsableId,
          }),
        });

    setGuardando(false);

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(
        String(
          data.error ??
            (editando
              ? "No pudimos guardar los cambios."
              : "No pudimos guardar la visita."),
        ),
      );
      return;
    }

    if (!editando) limpiar();
    router.refresh();

    if (seguirRegistrando && cliente) {
      setAviso(`Visita de ${cliente.nombre} guardada. Registra la siguiente.`);
      return;
    }
    onCerrar();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6">
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-formulario"
        className="my-4 w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2
              id="titulo-formulario"
              className="text-base font-semibold tracking-tight"
            >
              {editando ? `Editar visita ${visita?.id ?? ""}` : "Registrar visita"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Se guarda en la base Sirius CRM · tabla Visitas
              {editando ? " · el cliente y el responsable no cambian aquí" : ""}
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

        {/* Dictado de la visita completa */}
        <div className="border-b border-slate-200 bg-blue-50/60 px-5 py-4 dark:border-white/10 dark:bg-blue-500/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Cuenta la visita en voz</p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Habla normal: “Estuve presencial en Guaicaramo, necesitan
                controlar plaga, les presenté Biochar Blend, quedamos en enviar
                cotización la próxima semana”. Repartimos el texto en los campos
                y tú revisas.
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Para mayor precisión, nombra el campo mientras hablas:{" "}
                <span className="font-medium">“la próxima acción es…”</span>,{" "}
                <span className="font-medium">“las observaciones son…”</span>,{" "}
                <span className="font-medium">
                  “la fecha del próximo seguimiento es el 30 de agosto”
                </span>
                .
              </p>
            </div>
            <Microfono
              onTexto={aplicarDictado}
              vocabulario={vocabulario}
              disponible={transcripcionDisponible}
              etiqueta="Dictar visita completa"
              variante="amplio"
            />
          </div>

          {interpretado ? (
            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {interpretado.length > 0
                ? `Detectamos → ${interpretado.join(" · ")}. Revisa antes de guardar.`
                : "Transcribimos el audio en el objetivo. Completa el resto de campos."}
            </p>
          ) : null}
        </div>

        {borradorRestaurado ? (
          <p className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-2 text-xs text-slate-700 dark:border-white/10 dark:text-slate-300">
            Recuperamos un borrador sin guardar.
            <button
              type="button"
              onClick={limpiar}
              className="cursor-pointer underline hover:text-slate-900 dark:hover:text-white"
            >
              Empezar en blanco
            </button>
          </p>
        ) : null}

        {aviso ? (
          <p className="border-b border-slate-200 bg-emerald-50 px-5 py-2 text-xs font-medium text-emerald-800 dark:border-white/10 dark:bg-emerald-500/10 dark:text-emerald-300">
            {aviso}
          </p>
        ) : null}

        <form onSubmit={(e) => enviar(e)} className="flex flex-col gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Cliente" htmlFor="cliente" obligatorio>
              {/* Una visita hecha a otra empresa no es una corrección de datos,
                  es otra visita: al editar el cliente queda fijo. */}
              {editando ? (
                <p
                  id="cliente"
                  className={`${input} bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400`}
                >
                  {visita?.cliente ?? "Sin cliente"}
                </p>
              ) : (
              <select
                id="cliente"
                required
                value={datos.clienteId}
                onChange={(e) =>
                  // Cambiar de cliente invalida el contacto elegido.
                  actualizar({ clienteId: e.target.value, contactoCodigo: "" })
                }
                className={`${input} cursor-pointer`}
              >
                <option value="">Selecciona…</option>
                {clientes.map((c) => (
                  <option key={c.recordId} value={c.recordId}>
                    {c.nombre}
                    {c.ciudad && c.ciudad !== "N/A" ? ` · ${c.ciudad}` : ""}
                  </option>
                ))}
              </select>
              )}
              {cliente ? (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-mono">{cliente.id}</span>
                  {ultimaVisita
                    ? ` · última visita ${ultimaVisita.fecha ?? "—"}: ${ultimaVisita.resultado ?? "sin resultado"}`
                    : " · sin visitas previas"}
                </p>
              ) : null}
            </Campo>

            <Campo etiqueta="Contacto" htmlFor="contacto">
              <select
                id="contacto"
                value={datos.contactoCodigo}
                disabled={!datos.clienteId && !datos.contactoCodigo}
                onChange={(e) => actualizar({ contactoCodigo: e.target.value })}
                className={`${input} cursor-pointer`}
              >
                <option value="">
                  {datos.clienteId || datos.contactoCodigo
                    ? "Sin anotar"
                    : "Elige primero el cliente…"}
                </option>
                {contactosDelCliente.map((contacto) => (
                  <option key={contacto.codigo} value={contacto.codigo}>
                    {contacto.nombre}
                    {contacto.funciones.length > 0
                      ? ` · ${contacto.funciones.join(", ")}`
                      : ""}
                    {contacto.activo ? "" : " (inactivo)"}
                  </option>
                ))}
              </select>
              {datos.clienteId && contactosDelCliente.length === 0 ? (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Este cliente no tiene contactos activos en el directorio.
                </p>
              ) : null}
            </Campo>

            <Campo etiqueta="Fecha de la visita" htmlFor="fecha" obligatorio>
              <div className="flex gap-2">
                <input
                  id="fecha"
                  type="date"
                  required
                  value={datos.fecha}
                  onChange={(e) => actualizar({ fecha: e.target.value })}
                  className={`${input} cursor-pointer`}
                />
                <button
                  type="button"
                  onClick={() => actualizar({ fecha: hoy })}
                  className="shrink-0 cursor-pointer rounded-lg border border-slate-200 px-3 text-xs font-medium transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
                >
                  Hoy
                </button>
              </div>
            </Campo>

            <Campo etiqueta="Responsable comercial" htmlFor="responsable">
              {/* Se envía el ID de empleado, no el nombre: dos personas pueden
                  llamarse igual y el nombre puede escribirse distinto. */}
              <select
                id="responsable"
                value={datos.responsableId}
                onChange={(e) => actualizar({ responsableId: e.target.value })}
                className={`${input} cursor-pointer`}
              >
                {personal.some((p) => p.idEmpleado === idEmpleado) ? null : (
                  <option value="">{usuario} (tú)</option>
                )}
                {personal.map((p) => (
                  <option key={p.idEmpleado} value={p.idEmpleado}>
                    {p.nombre}
                    {p.idEmpleado === idEmpleado ? " (tú)" : ""}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo etiqueta="Tipo de visita" htmlFor="tipo" obligatorio>
              <div className="flex gap-2">
                {TIPOS_VISITA.map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={datos.tipo === valor}
                    onClick={() => actualizar({ tipo: valor })}
                    className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                      datos.tipo === valor
                        ? "border-blue-700 bg-blue-700 text-white dark:border-blue-500 dark:bg-blue-600"
                        : "border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    }`}
                  >
                    {valor}
                  </button>
                ))}
              </div>
            </Campo>
          </div>

          <Campo
            etiqueta="Objetivo de la visita"
            htmlFor="objetivo"
            obligatorio
            accesorio={
              <Microfono
                onTexto={(texto) =>
                  actualizar({ objetivo: unir(datos.objetivo, texto) })
                }
                vocabulario={vocabulario}
                disponible={transcripcionDisponible}
              />
            }
          >
            <textarea
              id="objetivo"
              required
              rows={2}
              value={datos.objetivo}
              onChange={(e) => actualizar({ objetivo: e.target.value })}
              placeholder="Presentar la línea de bioinsumos, revisar resultados en campo…"
              className={input}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {OBJETIVOS_FRECUENTES.map((sugerencia) => (
                <button
                  key={sugerencia}
                  type="button"
                  onClick={() =>
                    actualizar({ objetivo: unir(datos.objetivo, sugerencia) })
                  }
                  className="cursor-pointer rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700 transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  {sugerencia}
                </button>
              ))}
            </div>
          </Campo>

          <Campo
            etiqueta="Necesidad o diagnóstico identificado"
            htmlFor="necesidad"
            accesorio={
              <Microfono
                onTexto={(texto) =>
                  actualizar({ necesidad: unir(datos.necesidad, texto) })
                }
                vocabulario={vocabulario}
                disponible={transcripcionDisponible}
              />
            }
          >
            <textarea
              id="necesidad"
              rows={2}
              value={datos.necesidad}
              onChange={(e) => actualizar({ necesidad: e.target.value })}
              className={input}
            />
          </Campo>

          <fieldset>
            <legend className={etiquetaClase}>
              Productos de interés
              {datos.seleccionados.length > 0
                ? ` (${datos.seleccionados.length})`
                : ""}
            </legend>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">
              {productosOfrecidos.length === 0 ? (
                <p className="p-2 text-sm text-slate-600 dark:text-slate-400">
                  No hay productos activos en Sirius Product Core.
                </p>
              ) : (
                productosOfrecidos.map((producto) => (
                  <label
                    key={producto.recordId}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={datos.seleccionados.includes(producto.codigo)}
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

          <Campo etiqueta="Resultado" htmlFor="resultado" obligatorio>
            <select
              id="resultado"
              value={datos.resultado}
              onChange={(e) => actualizar({ resultado: e.target.value })}
              className={`${input} cursor-pointer`}
            >
              {RESULTADOS_VISITA.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </Campo>

          <Campo
            etiqueta="Próxima acción"
            htmlFor="proxima-accion"
            accesorio={
              <Microfono
                onTexto={(texto) =>
                  actualizar({
                    proximaAccion: unir(datos.proximaAccion, texto),
                  })
                }
                vocabulario={vocabulario}
                disponible={transcripcionDisponible}
              />
            }
          >
            <input
              id="proxima-accion"
              value={datos.proximaAccion}
              onChange={(e) => actualizar({ proximaAccion: e.target.value })}
              placeholder="Enviar cotización, agendar prueba de campo…"
              className={input}
            />
          </Campo>

          <Campo
            etiqueta="Fecha próximo seguimiento"
            htmlFor="fecha-seguimiento"
          >
            <input
              id="fecha-seguimiento"
              type="date"
              value={datos.fechaSeguimiento}
              onChange={(e) => actualizar({ fechaSeguimiento: e.target.value })}
              className={`${input} cursor-pointer`}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ATAJOS_FECHA.map((atajo) => (
                <button
                  key={atajo.texto}
                  type="button"
                  onClick={() =>
                    actualizar({ fechaSeguimiento: sumarDias(hoy, atajo.dias) })
                  }
                  className="cursor-pointer rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700 transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  {atajo.texto}
                </button>
              ))}
              {datos.fechaSeguimiento ? (
                <button
                  type="button"
                  onClick={() => actualizar({ fechaSeguimiento: "" })}
                  className="cursor-pointer rounded-full px-2.5 py-1 text-xs text-slate-600 underline dark:text-slate-400"
                >
                  Quitar
                </button>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              Lo que pongas aquí aparece en el calendario de pendientes.
            </p>
          </Campo>

          <Campo
            etiqueta="Pendientes"
            htmlFor="pendientes"
            accesorio={
              <Microfono
                onTexto={(texto) =>
                  actualizar({ pendientes: unir(datos.pendientes, texto) })
                }
                vocabulario={vocabulario}
                disponible={transcripcionDisponible}
              />
            }
          >
            <textarea
              id="pendientes"
              rows={2}
              value={datos.pendientes}
              onChange={(e) => actualizar({ pendientes: e.target.value })}
              placeholder="Lo que queda abierto: enviar ficha técnica, confirmar precio…"
              className={input}
            />
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              A diferencia de la próxima acción, esto no lleva fecha ni entra al
              calendario.
            </p>
          </Campo>

          <Campo
            etiqueta="Observaciones"
            htmlFor="observaciones"
            accesorio={
              <Microfono
                onTexto={(texto) =>
                  actualizar({
                    observaciones: unir(datos.observaciones, texto),
                  })
                }
                vocabulario={vocabulario}
                disponible={transcripcionDisponible}
              />
            }
          >
            <textarea
              id="observaciones"
              rows={2}
              value={datos.observaciones}
              onChange={(e) => actualizar({ observaciones: e.target.value })}
              className={input}
            />
          </Campo>

          {error ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ctrl + Enter guarda · Esc cierra
              {editando ? "" : " · el borrador se guarda solo"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onCerrar}
                className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              {editando ? null : (
                <button
                  type="button"
                  disabled={guardando}
                  onClick={(e) => enviar(e, true)}
                  className="cursor-pointer rounded-lg border border-blue-700 px-4 py-2 text-sm font-medium text-blue-800 transition-colors duration-200 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-400/50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                >
                  Guardar y registrar otra
                </button>
              )}
              <button
                type="submit"
                disabled={guardando}
                className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                {guardando
                  ? "Guardando…"
                  : editando
                    ? "Guardar cambios"
                    : "Guardar visita"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Campo({
  etiqueta,
  htmlFor,
  obligatorio,
  accesorio,
  children,
}: {
  etiqueta: string;
  htmlFor: string;
  obligatorio?: boolean;
  accesorio?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={htmlFor} className={etiquetaClase}>
          {etiqueta}
          {obligatorio ? (
            <span className="text-red-600 dark:text-red-400"> *</span>
          ) : null}
        </label>
        {accesorio}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** Agrega texto nuevo a un campo sin pisar lo que ya había. */
function unir(actual: string, nuevo: string): string {
  const limpio = nuevo.trim();
  if (!limpio) return actual;
  if (!actual.trim()) return limpio;
  return `${actual.trim()} ${limpio}`;
}

/**
 * Precarga el formulario con lo que ya tiene la visita que se va a corregir.
 *
 * Los productos se guardan como texto en Airtable, así que hay que volver a
 * cruzarlos con el catálogo — el completo, para no perder un descontinuado que
 * la visita ya referenciaba.
 */
function desdeVisita(
  visita: Visita,
  inicial: Formulario,
  productos: Producto[],
  clientes: ClienteCore[],
): Formulario {
  return {
    ...inicial,
    // El cliente no se edita, pero se resuelve desde su serial ("CL-0007")
    // para poder filtrar el directorio de contactos. Queda vacío si el cliente
    // está inactivo, porque el selector solo trae los activos.
    clienteId:
      clientes.find((cliente) => cliente.id === visita.idClienteCore)
        ?.recordId ?? "",
    contactoCodigo: visita.idContactoCore ?? "",
    fecha: visita.fecha?.slice(0, 10) ?? inicial.fecha,
    tipo: visita.tipo ?? inicial.tipo,
    objetivo: visita.objetivo ?? "",
    necesidad: visita.necesidad ?? "",
    seleccionados: codigosDelCatalogo(visita.idProductosCore, productos),
    resultado: visita.resultado ?? inicial.resultado,
    proximaAccion: visita.proximaAccion ?? "",
    fechaSeguimiento: visita.fechaSeguimiento?.slice(0, 10) ?? "",
    pendientes: visita.pendientes ?? "",
    observaciones: visita.observaciones ?? "",
  };
}

/** Devuelve el borrador guardado si tiene contenido útil. */
function leerBorrador(inicial: Formulario): Formulario | null {
  if (typeof window === "undefined") return null;

  try {
    const guardado = window.localStorage.getItem(CLAVE_BORRADOR);
    if (!guardado) return null;

    const parseado = JSON.parse(guardado) as Partial<Formulario>;
    if (!parseado.objetivo && !parseado.clienteId) return null;

    return { ...inicial, ...parseado };
  } catch {
    // Un borrador corrupto no debe impedir registrar la visita.
    return null;
  }
}
