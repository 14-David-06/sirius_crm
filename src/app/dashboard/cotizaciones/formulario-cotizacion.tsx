"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Cliente, ContactoCliente } from "@/lib/clientes";
import {
  ALMACENAMIENTO_POR_DEFECTO,
  ESTADOS_INICIALES_COTIZACION,
  FORMAS_PAGO,
  formatearPesos,
  MODALIDADES_ENTREGA,
  totalesDe,
  VIGENCIA_POR_DEFECTO,
  type EstadoCotizacion,
} from "@/lib/cotizaciones-comun";
import type { Producto } from "@/lib/productos";
import { IconClose, IconPlus } from "../icons";

const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";
const etiqueta = "text-xs font-medium text-slate-700 dark:text-slate-300";
const seccion =
  "text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-500";

type Renglon = {
  /** Clave estable de la fila mientras se edita; no viaja al servidor. */
  clave: string;
  codigo: string;
  cantidad: string;
  precio: string;
  descripcion: string;
};

function renglonVacio(indice: number): Renglon {
  return {
    clave: `r${indice}`,
    codigo: "",
    cantidad: "",
    precio: "",
    descripcion: "",
  };
}

export function FormularioCotizacion({
  clientes,
  contactos,
  productos,
  sesion,
  hoy,
  onCerrar,
}: {
  clientes: Cliente[];
  contactos: ContactoCliente[];
  productos: Producto[];
  sesion: { idEmpleado: string; nombre: string };
  hoy: string;
  onCerrar: () => void;
}) {
  const router = useRouter();

  const [clienteId, setClienteId] = useState("");
  const [contactoCodigo, setContactoCodigo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [introduccion, setIntroduccion] = useState("");
  const [fechaEmision, setFechaEmision] = useState(hoy);
  const [vigencia, setVigencia] = useState(String(VIGENCIA_POR_DEFECTO));
  const [estado, setEstado] = useState<EstadoCotizacion>("Borrador");
  const [iva, setIva] = useState("");

  const [renglones, setRenglones] = useState<Renglon[]>([renglonVacio(0)]);

  const [modalidad, setModalidad] = useState("");
  const [puntoEntrega, setPuntoEntrega] = useState("");
  const [valorFlete, setValorFlete] = useState("");
  const [fechaDespacho, setFechaDespacho] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [quienRecibe, setQuienRecibe] = useState("");
  const [horarioRecibo, setHorarioRecibo] = useState("");

  const [formaPago, setFormaPago] = useState("");
  const [ordenCompra, setOrdenCompra] = useState("");
  const [emailFacturacion, setEmailFacturacion] = useState("");
  const [registroIca, setRegistroIca] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [presentacion, setPresentacion] = useState("");
  const [unidades, setUnidades] = useState("");
  const [almacenamiento, setAlmacenamiento] = useState(
    ALMACENAMIENTO_POR_DEFECTO,
  );
  const [vidaUtil, setVidaUtil] = useState("");
  const [notasInternas, setNotasInternas] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const siguienteClave = useRef(1);
  const dialogoRef = useRef<HTMLDivElement>(null);

  const porCodigo = useMemo(
    () => new Map(productos.map((p) => [p.codigo, p])),
    [productos],
  );

  const cliente = clientes.find((c) => c.recordId === clienteId);

  /** Solo el personal del cliente elegido: dirigir la oferta al contacto de
   *  otra empresa es un error que solo se ve cuando ya está impresa. */
  const contactosDelCliente = useMemo(
    () =>
      cliente
        ? contactos.filter((c) => c.clientes.includes(cliente.recordId))
        : [],
    [contactos, cliente],
  );

  const totales = useMemo(() => {
    const lineas = renglones
      .map((renglon) => ({
        cantidad: Number(renglon.cantidad),
        precioUnitario: Number(renglon.precio || 0),
      }))
      .filter(
        (linea) =>
          Number.isFinite(linea.cantidad) &&
          Number.isFinite(linea.precioUnitario),
      );

    const porcentaje = iva.trim() === "" ? null : Number(iva);
    return totalesDe(
      lineas,
      porcentaje !== null && Number.isFinite(porcentaje) ? porcentaje : null,
    );
  }, [renglones, iva]);

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

  /**
   * Cambiar de cliente descarta el destinatario elegido: un contacto de la
   * empresa anterior que se quedara seleccionado dirigiría la oferta a la
   * persona equivocada, y eso solo se ve cuando ya está impresa.
   */
  function elegirCliente(recordId: string) {
    setClienteId(recordId);
    setContactoCodigo("");
  }

  function actualizarRenglon(clave: string, cambios: Partial<Renglon>) {
    setRenglones((previos) =>
      previos.map((renglon) =>
        renglon.clave === clave ? { ...renglon, ...cambios } : renglon,
      ),
    );
  }

  /** Al elegir producto se proponen su precio de lista y su descripción. */
  function elegirProducto(clave: string, codigo: string) {
    const producto = porCodigo.get(codigo);
    const cambios: Partial<Renglon> = { codigo };

    if (producto?.precio !== null && producto?.precio !== undefined) {
      cambios.precio = String(producto.precio);
    }
    if (producto?.observaciones) {
      cambios.descripcion = producto.observaciones;
    }

    actualizarRenglon(clave, cambios);
  }

  function agregarRenglon() {
    setRenglones((previos) => [
      ...previos,
      renglonVacio(siguienteClave.current++),
    ]);
  }

  function quitarRenglon(clave: string) {
    setRenglones((previos) =>
      previos.length === 1
        ? previos
        : previos.filter((renglon) => renglon.clave !== clave),
    );
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    if (!cliente) {
      setError("Elige un cliente de la lista.");
      return;
    }
    if (!titulo.trim()) {
      setError("Ponle un título: de qué es la oferta.");
      return;
    }

    const lineas = renglones
      .filter((renglon) => renglon.codigo)
      .map((renglon) => ({
        idProductoCore: renglon.codigo,
        cantidad: Number(renglon.cantidad),
        precioUnitario: Number(renglon.precio || 0),
        descripcion: renglon.descripcion.trim() || undefined,
      }));

    if (lineas.length === 0) {
      setError("Agrega al menos un producto a la cotización.");
      return;
    }
    if (
      lineas.some(
        (linea) => !Number.isFinite(linea.cantidad) || linea.cantidad <= 0,
      )
    ) {
      setError("Cada renglón necesita una cantidad mayor que cero.");
      return;
    }

    setGuardando(true);
    setError(null);

    const respuesta = await fetch("/api/cotizaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idClienteCore: cliente.id,
        idContactoCliente: contactoCodigo || undefined,
        titulo: titulo.trim(),
        introduccion: introduccion.trim() || undefined,
        fechaEmision,
        vigenciaDias: Number(vigencia),
        estado,
        ivaPorcentaje: iva.trim() === "" ? undefined : Number(iva),
        modalidadEntrega: modalidad || undefined,
        puntoEntrega: puntoEntrega.trim() || undefined,
        valorFlete: valorFlete.trim() === "" ? undefined : Number(valorFlete),
        fechaDespacho: fechaDespacho || undefined,
        fechaEntrega: fechaEntrega || undefined,
        quienRecibe: quienRecibe.trim() || undefined,
        horarioRecibo: horarioRecibo.trim() || undefined,
        formaPago: formaPago || undefined,
        ordenCompra: ordenCompra.trim() || undefined,
        emailFacturacion: emailFacturacion.trim() || undefined,
        registroIca: registroIca.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        presentacion: presentacion.trim() || undefined,
        unidades: unidades.trim() || undefined,
        almacenamiento: almacenamiento.trim() || undefined,
        vidaUtilDias: vidaUtil.trim() === "" ? undefined : Number(vidaUtil),
        notasInternas: notasInternas.trim() || undefined,
        lineas,
      }),
    });

    const data = (await respuesta.json().catch(() => ({}))) as {
      error?: string;
    };

    setGuardando(false);

    if (!respuesta.ok) {
      setError(data.error ?? "No pudimos guardar la cotización.");
      return;
    }

    router.refresh();
    onCerrar();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6">
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-cotizacion"
        className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2
              id="titulo-cotizacion"
              className="text-base font-semibold tracking-tight"
            >
              Emitir cotización
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Se guarda en Sirius Cotizaciones Core · el consecutivo lo asigna
              el sistema
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="cursor-pointer rounded-lg p-2 text-slate-600 transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-300 dark:hover:bg-white/10"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={enviar} className="flex flex-col gap-6 px-5 py-5">
          {/* ------------------------- Destinatario ------------------------- */}
          <fieldset className="flex flex-col gap-3 border-0 p-0">
            <legend className={seccion}>Destinatario</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="cot-cliente" texto="Cliente *">
                <select
                  id="cot-cliente"
                  value={clienteId}
                  onChange={(e) => elegirCliente(e.target.value)}
                  disabled={guardando}
                  className={`${input} cursor-pointer`}
                >
                  <option value="">Selecciona…</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.recordId} value={cliente.recordId}>
                      {cliente.nombre}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo id="cot-contacto" texto="Atención">
                <select
                  id="cot-contacto"
                  value={contactoCodigo}
                  onChange={(e) => setContactoCodigo(e.target.value)}
                  disabled={guardando || contactosDelCliente.length === 0}
                  className={`${input} cursor-pointer`}
                >
                  <option value="">
                    {cliente
                      ? contactosDelCliente.length === 0
                        ? "Este cliente no tiene contactos"
                        : "Sin destinatario"
                      : "Elige primero el cliente"}
                  </option>
                  {contactosDelCliente.map((contacto) => (
                    <option key={contacto.recordId} value={contacto.codigo ?? ""}>
                      {contacto.nombre}
                      {contacto.cargo ? ` · ${contacto.cargo}` : ""}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo id="cot-titulo" texto="Título de la oferta *">
                <input
                  id="cot-titulo"
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  disabled={guardando}
                  placeholder="Ej. Microbiología agrícola"
                  className={input}
                />
              </Campo>

              <Campo id="cot-responsable" texto="Emitida por">
                {/* La cotización queda a nombre de quien la emite, siempre: es
                    la clave de propiedad con la que se decide quién puede
                    tocarla, así que no se elige. */}
                <p
                  id="cot-responsable"
                  className={`${input} bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400`}
                >
                  {sesion.nombre}
                </p>
              </Campo>
            </div>

            <Campo id="cot-introduccion" texto="Presentación de lo ofertado">
              <textarea
                id="cot-introduccion"
                rows={2}
                value={introduccion}
                onChange={(e) => setIntroduccion(e.target.value)}
                disabled={guardando}
                placeholder="Encabeza la sección del producto en el documento"
                className={input}
              />
            </Campo>
          </fieldset>

          {/* --------------------------- Vigencia --------------------------- */}
          <fieldset className="flex flex-col gap-3 border-0 p-0">
            <legend className={seccion}>Emisión y vigencia</legend>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo id="cot-fecha" texto="Fecha de emisión *">
                <input
                  id="cot-fecha"
                  type="date"
                  value={fechaEmision}
                  onChange={(e) => setFechaEmision(e.target.value)}
                  disabled={guardando}
                  className={input}
                />
              </Campo>

              <Campo id="cot-vigencia" texto="Vigencia (días) *">
                <input
                  id="cot-vigencia"
                  type="number"
                  min="1"
                  max="365"
                  step="1"
                  inputMode="numeric"
                  value={vigencia}
                  onChange={(e) => setVigencia(e.target.value)}
                  disabled={guardando}
                  className={input}
                />
              </Campo>

              <Campo id="cot-estado" texto="Estado inicial *">
                <select
                  id="cot-estado"
                  value={estado}
                  onChange={(e) =>
                    setEstado(e.target.value as EstadoCotizacion)
                  }
                  disabled={guardando}
                  className={`${input} cursor-pointer`}
                >
                  {ESTADOS_INICIALES_COTIZACION.map((valor) => (
                    <option key={valor} value={valor}>
                      {valor}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo id="cot-iva" texto="IVA (%)">
                <input
                  id="cot-iva"
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  inputMode="decimal"
                  value={iva}
                  onChange={(e) => setIva(e.target.value)}
                  disabled={guardando}
                  placeholder="Por confirmar"
                  className={input}
                />
              </Campo>
            </div>
          </fieldset>

          {/* --------------------------- Renglones -------------------------- */}
          <fieldset className="flex flex-col gap-3 border-0 p-0">
            <div className="flex items-center justify-between gap-3">
              <legend className={seccion}>Oferta comercial *</legend>
              <button
                type="button"
                onClick={agregarRenglon}
                disabled={guardando}
                className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-800 transition-colors duration-200 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-60 dark:text-blue-300 dark:hover:bg-blue-500/15"
              >
                <IconPlus className="h-3.5 w-3.5" />
                Agregar renglón
              </button>
            </div>

            <ul className="flex flex-col gap-2">
              {renglones.map((renglon) => {
                const producto = porCodigo.get(renglon.codigo);
                return (
                  <li
                    key={renglon.clave}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/10"
                  >
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                      <Campo
                        id={`cot-producto-${renglon.clave}`}
                        texto="Producto"
                        menudo
                      >
                        <select
                          id={`cot-producto-${renglon.clave}`}
                          value={renglon.codigo}
                          onChange={(e) =>
                            elegirProducto(renglon.clave, e.target.value)
                          }
                          disabled={guardando}
                          className={`${input} cursor-pointer`}
                        >
                          <option value="">Selecciona…</option>
                          {productos.map((producto) => (
                            <option key={producto.codigo} value={producto.codigo}>
                              {producto.nombre}
                            </option>
                          ))}
                        </select>
                      </Campo>

                      <Campo
                        id={`cot-cantidad-${renglon.clave}`}
                        texto={`Cantidad${producto?.unidad ? ` (${producto.unidad})` : ""}`}
                        menudo
                      >
                        <input
                          id={`cot-cantidad-${renglon.clave}`}
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={renglon.cantidad}
                          onChange={(e) =>
                            actualizarRenglon(renglon.clave, {
                              cantidad: e.target.value,
                            })
                          }
                          disabled={guardando}
                          className={input}
                        />
                      </Campo>

                      <Campo
                        id={`cot-precio-${renglon.clave}`}
                        texto="Precio unitario"
                        menudo
                      >
                        <input
                          id={`cot-precio-${renglon.clave}`}
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={renglon.precio}
                          onChange={(e) =>
                            actualizarRenglon(renglon.clave, {
                              precio: e.target.value,
                            })
                          }
                          disabled={guardando}
                          className={input}
                        />
                      </Campo>

                      <button
                        type="button"
                        onClick={() => quitarRenglon(renglon.clave)}
                        disabled={guardando || renglones.length === 1}
                        aria-label="Quitar renglón"
                        className="cursor-pointer rounded-lg p-2 text-slate-600 transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-40 dark:text-slate-300 dark:hover:bg-white/10"
                      >
                        <IconClose className="h-4 w-4" />
                      </button>
                    </div>

                    <Campo
                      id={`cot-descripcion-${renglon.clave}`}
                      texto="Qué hace el producto"
                      menudo
                    >
                      <textarea
                        id={`cot-descripcion-${renglon.clave}`}
                        rows={2}
                        value={renglon.descripcion}
                        onChange={(e) =>
                          actualizarRenglon(renglon.clave, {
                            descripcion: e.target.value,
                          })
                        }
                        disabled={guardando}
                        className={input}
                      />
                    </Campo>
                  </li>
                );
              })}
            </ul>

            <dl className="ml-auto flex flex-col gap-1 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-slate-600 dark:text-slate-400">Subtotal</dt>
                <dd className="tabular-nums">
                  {formatearPesos(totales.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-slate-600 dark:text-slate-400">IVA</dt>
                <dd className="tabular-nums">
                  {totales.iva === null
                    ? "Por confirmar"
                    : formatearPesos(totales.iva)}
                </dd>
              </div>
              <div className="flex justify-between gap-6 border-t border-slate-200 pt-1 font-semibold dark:border-white/10">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatearPesos(totales.total)}</dd>
              </div>
            </dl>
          </fieldset>

          {/* ------------------------ Entrega y flete ----------------------- */}
          <fieldset className="flex flex-col gap-3 border-0 p-0">
            <legend className={seccion}>Entrega y transporte</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="cot-modalidad" texto="Modalidad">
                <select
                  id="cot-modalidad"
                  value={modalidad}
                  onChange={(e) => setModalidad(e.target.value)}
                  disabled={guardando}
                  className={`${input} cursor-pointer`}
                >
                  <option value="">Por confirmar</option>
                  {MODALIDADES_ENTREGA.map((valor) => (
                    <option key={valor} value={valor}>
                      {valor}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo id="cot-punto" texto="Punto de entrega">
                <input
                  id="cot-punto"
                  type="text"
                  value={puntoEntrega}
                  onChange={(e) => setPuntoEntrega(e.target.value)}
                  disabled={guardando}
                  placeholder="Finca o bodega y municipio"
                  className={input}
                />
              </Campo>

              <Campo id="cot-flete" texto="Valor del flete">
                <input
                  id="cot-flete"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={valorFlete}
                  onChange={(e) => setValorFlete(e.target.value)}
                  disabled={guardando}
                  placeholder="No aplica"
                  className={input}
                />
              </Campo>

              <Campo id="cot-quien-recibe" texto="Quién recibe">
                <input
                  id="cot-quien-recibe"
                  type="text"
                  value={quienRecibe}
                  onChange={(e) => setQuienRecibe(e.target.value)}
                  disabled={guardando}
                  placeholder="Nombre y celular"
                  className={input}
                />
              </Campo>

              <Campo id="cot-despacho" texto="Fecha de despacho">
                <input
                  id="cot-despacho"
                  type="date"
                  value={fechaDespacho}
                  onChange={(e) => setFechaDespacho(e.target.value)}
                  disabled={guardando}
                  className={input}
                />
              </Campo>

              <Campo id="cot-entrega" texto="Fecha de entrega">
                <input
                  id="cot-entrega"
                  type="date"
                  value={fechaEntrega}
                  min={fechaDespacho || undefined}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  disabled={guardando}
                  className={input}
                />
              </Campo>

              <Campo id="cot-horario" texto="Horario de recibo">
                <input
                  id="cot-horario"
                  type="text"
                  value={horarioRecibo}
                  onChange={(e) => setHorarioRecibo(e.target.value)}
                  disabled={guardando}
                  placeholder="Ej. lunes a viernes, 7:00 a 16:00"
                  className={input}
                />
              </Campo>
            </div>
          </fieldset>

          {/* --------------------- Condiciones comerciales ------------------- */}
          <fieldset className="flex flex-col gap-3 border-0 p-0">
            <legend className={seccion}>Condiciones comerciales</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="cot-pago" texto="Forma de pago">
                <select
                  id="cot-pago"
                  value={formaPago}
                  onChange={(e) => setFormaPago(e.target.value)}
                  disabled={guardando}
                  className={`${input} cursor-pointer`}
                >
                  <option value="">Por acordar</option>
                  {FORMAS_PAGO.map((valor) => (
                    <option key={valor} value={valor}>
                      {valor}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo id="cot-oc" texto="Orden de compra">
                <input
                  id="cot-oc"
                  type="text"
                  value={ordenCompra}
                  onChange={(e) => setOrdenCompra(e.target.value)}
                  disabled={guardando}
                  placeholder="Número de OC"
                  className={input}
                />
              </Campo>

              <Campo id="cot-facturacion" texto="Correo de facturación">
                <input
                  id="cot-facturacion"
                  type="email"
                  value={emailFacturacion}
                  onChange={(e) => setEmailFacturacion(e.target.value)}
                  disabled={guardando}
                  className={input}
                />
              </Campo>

              <Campo id="cot-ica" texto="Registro ICA">
                <input
                  id="cot-ica"
                  type="text"
                  value={registroIca}
                  onChange={(e) => setRegistroIca(e.target.value)}
                  disabled={guardando}
                  placeholder="Número de registro por producto"
                  className={input}
                />
              </Campo>
            </div>

            <Campo id="cot-observaciones" texto="Observaciones">
              <textarea
                id="cot-observaciones"
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                disabled={guardando}
                placeholder="Acuerdos particulares de esta negociación"
                className={input}
              />
            </Campo>
          </fieldset>

          {/* --------------------- Presentación y manejo --------------------- */}
          <fieldset className="flex flex-col gap-3 border-0 p-0">
            <legend className={seccion}>Presentación y manejo</legend>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo id="cot-presentacion" texto="Presentación">
                <input
                  id="cot-presentacion"
                  type="text"
                  value={presentacion}
                  onChange={(e) => setPresentacion(e.target.value)}
                  disabled={guardando}
                  placeholder="Ej. garrafa de 20 L"
                  className={input}
                />
              </Campo>

              <Campo id="cot-unidades" texto="Unidades">
                <input
                  id="cot-unidades"
                  type="text"
                  value={unidades}
                  onChange={(e) => setUnidades(e.target.value)}
                  disabled={guardando}
                  placeholder="Ej. 2 garrafas"
                  className={input}
                />
              </Campo>

              <Campo id="cot-vida-util" texto="Vida útil (días)">
                <input
                  id="cot-vida-util"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={vidaUtil}
                  onChange={(e) => setVidaUtil(e.target.value)}
                  disabled={guardando}
                  className={input}
                />
              </Campo>
            </div>

            <Campo id="cot-almacenamiento" texto="Almacenamiento">
              <textarea
                id="cot-almacenamiento"
                rows={2}
                value={almacenamiento}
                onChange={(e) => setAlmacenamiento(e.target.value)}
                disabled={guardando}
                className={input}
              />
            </Campo>

            <Campo id="cot-notas" texto="Notas internas">
              <textarea
                id="cot-notas"
                rows={2}
                value={notasInternas}
                onChange={(e) => setNotasInternas(e.target.value)}
                disabled={guardando}
                placeholder="No se imprime en el documento"
                className={input}
              />
            </Campo>
          </fieldset>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Ctrl + Enter guarda · Esc cierra
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCerrar}
                disabled={guardando}
                className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-60 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                {guardando ? "Guardando…" : "Emitir cotización"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Campo({
  id,
  texto,
  menudo,
  children,
}: {
  id: string;
  texto: string;
  menudo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={
          menudo ? "text-[11px] text-slate-600 dark:text-slate-400" : etiqueta
        }
      >
        {texto}
      </label>
      {children}
    </div>
  );
}
