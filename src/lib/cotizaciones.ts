import {
  actualizarRegistro,
  crearRegistro,
  listarRegistros,
  texto,
  type AirtableRecord,
} from "@/lib/airtable";
import { cachearLectura, ETIQUETAS } from "@/lib/cache";
import {
  leerSerialCotizacion,
  serialCotizacion,
  serialLinea,
  totalesDe,
  type EstadoCotizacion,
  type FormaPago,
  type ModalidadEntrega,
} from "@/lib/cotizaciones-comun";
import { env } from "@/lib/env";

/**
 * Base "Sirius Cotizaciones Core": las ofertas comerciales y sus renglones.
 *
 * A diferencia de Sirius Pedidos Core, esta base la escribe solo el CRM, así
 * que los campos son los que el documento necesita imprimir y nada más.
 *
 * Lo que se congela al emitir —razón social, NIT, nombre y cargo del contacto,
 * nombre y precio de cada producto— se guarda aquí en texto aunque viva en
 * otra base. No es duplicación por comodidad: una cotización es un documento
 * controlado, y si se leyera en vivo del maestro, reimprimir una oferta de
 * hace tres meses mostraría el precio de hoy y contradiría lo que el cliente
 * firmó. La fuente de verdad para *cruzar* sigue siendo el serial.
 */

const CAMPOS_COTIZACION = {
  id: "ID",
  revision: "Revision",
  idClienteCore: "ID Cliente Core",
  cliente: "Cliente",
  nitCliente: "NIT Cliente",
  idContactoCliente: "ID Contacto Cliente",
  contacto: "Contacto",
  cargoContacto: "Cargo Contacto",
  idPersonalCore: "ID Personal Core",
  responsable: "Responsable Comercial",
  titulo: "Titulo",
  introduccion: "Introduccion",
  fechaEmision: "Fecha Emision",
  vigenciaDias: "Vigencia Dias",
  estado: "Estado",
  fechaEnvio: "Fecha Envio",
  fechaCierre: "Fecha Cierre",
  motivoCierre: "Motivo Cierre",
  ivaPorcentaje: "IVA Porcentaje",
  modalidadEntrega: "Modalidad Entrega",
  puntoEntrega: "Punto Entrega",
  valorFlete: "Valor Flete",
  fechaDespacho: "Fecha Despacho",
  fechaEntrega: "Fecha Entrega",
  quienRecibe: "Quien Recibe",
  horarioRecibo: "Horario Recibo",
  formaPago: "Forma de Pago",
  ordenCompra: "Orden de Compra",
  emailFacturacion: "Email Facturacion",
  registroIca: "Registro ICA",
  observaciones: "Observaciones",
  presentacion: "Presentacion",
  unidades: "Unidades",
  almacenamiento: "Almacenamiento",
  vidaUtilDias: "Vida Util Dias",
  notasInternas: "Notas Internas",
  fechaCreacion: "Fecha Creacion",
  modificadoPor: "Modificado Por ID",
} as const;

const CAMPOS_DETALLE = {
  id: "ID",
  cotizacion: "Cotizacion",
  orden: "Orden",
  idProductoCore: "ID Producto Core",
  producto: "Producto",
  descripcion: "Descripcion",
  fichaTecnica: "Ficha Tecnica",
  cantidad: "Cantidad",
  unidad: "Unidad",
  precioUnitario: "Precio Unitario",
} as const;

export {
  ALMACENAMIENTO_POR_DEFECTO,
  cierraCotizacion,
  EMISOR,
  ESTADOS_COTIZACION,
  ESTADOS_INICIALES_COTIZACION,
  estaCerradaCotizacion,
  estaVencidaPorFecha,
  FORMAS_PAGO,
  formatearCantidad,
  formatearFechaLarga,
  formatearPesos,
  formatearRevision,
  formatearVigencia,
  MODALIDADES_ENTREGA,
  NOTA_MODALIDAD,
  serialCotizacion,
  siguientesEstadosCotizacion,
  textoLegal,
  totalesDe,
  vencimientoDe,
  VIGENCIA_POR_DEFECTO,
} from "@/lib/cotizaciones-comun";
export type {
  EstadoCotizacion,
  FormaPago,
  ModalidadEntrega,
  Totales,
} from "@/lib/cotizaciones-comun";

export type LineaCotizacion = {
  recordId: string;
  id: string;
  orden: number;
  idProductoCore: string | null;
  /** Nombre congelado al emitir, no el del catálogo de hoy. */
  producto: string | null;
  descripcion: string | null;
  fichaTecnica: string | null;
  cantidad: number;
  unidad: string | null;
  /** Precio congelado al emitir; 0 es un precio real (muestras comerciales). */
  precioUnitario: number;
  subtotal: number;
};

export type Cotizacion = {
  recordId: string;
  /** Consecutivo controlado, formato COT-YYYY-NNN. */
  id: string;
  revision: number;
  idClienteCore: string | null;
  cliente: string | null;
  nitCliente: string | null;
  idContactoCliente: string | null;
  contacto: string | null;
  cargoContacto: string | null;
  /** ID Empleado de quien emite: la clave de propiedad para los permisos. */
  idPersonalCore: string | null;
  responsable: string | null;
  titulo: string | null;
  introduccion: string | null;
  fechaEmision: string | null;
  vigenciaDias: number | null;
  estado: string | null;
  fechaEnvio: string | null;
  fechaCierre: string | null;
  motivoCierre: string | null;
  /** null es "por confirmar con facturación"; 0 es un IVA de 0 % real. */
  ivaPorcentaje: number | null;
  modalidadEntrega: string | null;
  puntoEntrega: string | null;
  valorFlete: number | null;
  fechaDespacho: string | null;
  fechaEntrega: string | null;
  quienRecibe: string | null;
  horarioRecibo: string | null;
  formaPago: string | null;
  ordenCompra: string | null;
  emailFacturacion: string | null;
  registroIca: string | null;
  observaciones: string | null;
  presentacion: string | null;
  unidades: string | null;
  almacenamiento: string | null;
  vidaUtilDias: number | null;
  /** No se imprime en el documento: es contexto para el equipo. */
  notasInternas: string | null;
  lineas: LineaCotizacion[];
  subtotal: number;
  /** null mientras el IVA esté por confirmar. */
  iva: number | null;
  total: number;
};

function numero(valor: unknown): number | null {
  return typeof valor === "number" ? valor : null;
}

/** Los campos de vínculo llegan como arreglo de record ids. */
function vinculos(valor: unknown): string[] {
  return Array.isArray(valor)
    ? valor.filter((item): item is string => typeof item === "string")
    : [];
}

function aLinea(registro: AirtableRecord): LineaCotizacion {
  const f = registro.fields;
  const cantidad = numero(f[CAMPOS_DETALLE.cantidad]) ?? 0;
  const precioUnitario = numero(f[CAMPOS_DETALLE.precioUnitario]) ?? 0;

  return {
    recordId: registro.id,
    id: texto(f[CAMPOS_DETALLE.id]) ?? registro.id,
    orden: numero(f[CAMPOS_DETALLE.orden]) ?? 0,
    idProductoCore: texto(f[CAMPOS_DETALLE.idProductoCore]),
    producto: texto(f[CAMPOS_DETALLE.producto]),
    descripcion: texto(f[CAMPOS_DETALLE.descripcion]),
    fichaTecnica: texto(f[CAMPOS_DETALLE.fichaTecnica]),
    cantidad,
    unidad: texto(f[CAMPOS_DETALLE.unidad]),
    precioUnitario,
    subtotal: cantidad * precioUnitario,
  };
}

function aCotizacion(
  registro: AirtableRecord,
  lineas: LineaCotizacion[],
): Cotizacion {
  const f = registro.fields;
  const ivaPorcentaje = numero(f[CAMPOS_COTIZACION.ivaPorcentaje]);
  const totales = totalesDe(lineas, ivaPorcentaje);

  return {
    recordId: registro.id,
    id: texto(f[CAMPOS_COTIZACION.id]) ?? registro.id,
    revision: numero(f[CAMPOS_COTIZACION.revision]) ?? 0,
    idClienteCore: texto(f[CAMPOS_COTIZACION.idClienteCore]),
    cliente: texto(f[CAMPOS_COTIZACION.cliente]),
    nitCliente: texto(f[CAMPOS_COTIZACION.nitCliente]),
    idContactoCliente: texto(f[CAMPOS_COTIZACION.idContactoCliente]),
    contacto: texto(f[CAMPOS_COTIZACION.contacto]),
    cargoContacto: texto(f[CAMPOS_COTIZACION.cargoContacto]),
    idPersonalCore: texto(f[CAMPOS_COTIZACION.idPersonalCore]),
    responsable: texto(f[CAMPOS_COTIZACION.responsable]),
    titulo: texto(f[CAMPOS_COTIZACION.titulo]),
    introduccion: texto(f[CAMPOS_COTIZACION.introduccion]),
    fechaEmision: texto(f[CAMPOS_COTIZACION.fechaEmision]),
    vigenciaDias: numero(f[CAMPOS_COTIZACION.vigenciaDias]),
    estado: texto(f[CAMPOS_COTIZACION.estado]),
    fechaEnvio: texto(f[CAMPOS_COTIZACION.fechaEnvio]),
    fechaCierre: texto(f[CAMPOS_COTIZACION.fechaCierre]),
    motivoCierre: texto(f[CAMPOS_COTIZACION.motivoCierre]),
    ivaPorcentaje,
    modalidadEntrega: texto(f[CAMPOS_COTIZACION.modalidadEntrega]),
    puntoEntrega: texto(f[CAMPOS_COTIZACION.puntoEntrega]),
    valorFlete: numero(f[CAMPOS_COTIZACION.valorFlete]),
    fechaDespacho: texto(f[CAMPOS_COTIZACION.fechaDespacho]),
    fechaEntrega: texto(f[CAMPOS_COTIZACION.fechaEntrega]),
    quienRecibe: texto(f[CAMPOS_COTIZACION.quienRecibe]),
    horarioRecibo: texto(f[CAMPOS_COTIZACION.horarioRecibo]),
    formaPago: texto(f[CAMPOS_COTIZACION.formaPago]),
    ordenCompra: texto(f[CAMPOS_COTIZACION.ordenCompra]),
    emailFacturacion: texto(f[CAMPOS_COTIZACION.emailFacturacion]),
    registroIca: texto(f[CAMPOS_COTIZACION.registroIca]),
    observaciones: texto(f[CAMPOS_COTIZACION.observaciones]),
    presentacion: texto(f[CAMPOS_COTIZACION.presentacion]),
    unidades: texto(f[CAMPOS_COTIZACION.unidades]),
    almacenamiento: texto(f[CAMPOS_COTIZACION.almacenamiento]),
    vidaUtilDias: numero(f[CAMPOS_COTIZACION.vidaUtilDias]),
    notasInternas: texto(f[CAMPOS_COTIZACION.notasInternas]),
    lineas,
    subtotal: totales.subtotal,
    iva: totales.iva,
    total: totales.total,
  };
}

/** Agrupa los renglones por el vínculo que guardan hacia su cotización. */
function lineasPorCotizacion(
  detalles: AirtableRecord[],
): Map<string, LineaCotizacion[]> {
  const mapa = new Map<string, LineaCotizacion[]>();

  for (const registro of detalles) {
    for (const recordId of vinculos(registro.fields[CAMPOS_DETALLE.cotizacion])) {
      const linea = aLinea(registro);
      const lista = mapa.get(recordId);
      if (lista) lista.push(linea);
      else mapa.set(recordId, [linea]);
    }
  }

  // El orden del documento manda; el serial es el desempate para los renglones
  // viejos a los que nadie les puso orden.
  for (const lista of mapa.values()) {
    lista.sort(
      (a, b) =>
        a.orden - b.orden || a.id.localeCompare(b.id, "es", { numeric: true }),
    );
  }

  return mapa;
}

const leerCotizaciones = cachearLectura(
  "cotizaciones",
  ETIQUETAS.cotizaciones,
  async (): Promise<Cotizacion[]> => {
    const [registros, detalles] = await Promise.all([
      listarRegistros(env.baseCotizaciones, env.tablaCotizaciones, {
        fields: Object.values(CAMPOS_COTIZACION),
      }),
      listarRegistros(env.baseCotizaciones, env.tablaDetallesCotizacion, {
        fields: Object.values(CAMPOS_DETALLE),
      }),
    ]);

    const porCotizacion = lineasPorCotizacion(detalles);

    return registros
      .map((registro) =>
        aCotizacion(registro, porCotizacion.get(registro.id) ?? []),
      )
      // Lo más reciente arriba; a igual fecha, el consecutivo mayor primero.
      .sort(
        (a, b) =>
          (b.fechaEmision ?? "").localeCompare(a.fechaEmision ?? "") ||
          b.id.localeCompare(a.id, "es", { numeric: true }),
      );
  },
);

export async function listarCotizaciones(): Promise<Cotizacion[]> {
  return leerCotizaciones();
}

/**
 * Una cotización leída sin caché, con sus renglones. Se usa antes de escribir
 * y para imprimir: decidir un permiso sobre un dato viejo dejaría editar algo
 * que ya cambió de dueño, y el documento debe salir con lo que hay ahora.
 */
export async function obtenerCotizacion(
  recordId: string,
): Promise<Cotizacion | null> {
  const registros = await listarRegistros(
    env.baseCotizaciones,
    env.tablaCotizaciones,
    {
      fields: Object.values(CAMPOS_COTIZACION),
      filterByFormula: `RECORD_ID() = '${recordId}'`,
      maxRecords: 1,
    },
  );

  const registro = registros[0];
  if (!registro) return null;

  const detalles = await listarRegistros(
    env.baseCotizaciones,
    env.tablaDetallesCotizacion,
    { fields: Object.values(CAMPOS_DETALLE) },
  );

  return aCotizacion(
    registro,
    lineasPorCotizacion(detalles).get(registro.id) ?? [],
  );
}

/* ------------------------------ Consecutivo ------------------------------ */

/**
 * El consecutivo más alto ya emitido en un año.
 *
 * Se lee sin caché y solo los del año: la numeración reinicia cada enero, así
 * que el máximo global daría un salto en vez del siguiente número.
 */
async function ultimoConsecutivo(anio: number): Promise<number> {
  const registros = await listarRegistros(
    env.baseCotizaciones,
    env.tablaCotizaciones,
    {
      fields: [CAMPOS_COTIZACION.id],
      filterByFormula: `LEFT({${CAMPOS_COTIZACION.id}}, 9) = 'COT-${anio}-'`,
    },
  );

  return registros.reduce((mayor, registro) => {
    const leido = leerSerialCotizacion(texto(registro.fields[CAMPOS_COTIZACION.id]));
    return leido && leido.anio === anio && leido.consecutivo > mayor
      ? leido.consecutivo
      : mayor;
  }, 0);
}

const INTENTOS_SERIAL = 3;

/**
 * Resuelve la colisión de consecutivo que deja una emisión simultánea.
 *
 * El número se calcula leyendo el máximo del año, así que dos personas que
 * emiten en el mismo segundo obtienen el mismo. Airtable no tiene restricción
 * de unicidad, y en un documento controlado dos ofertas con el mismo
 * consecutivo es exactamente lo que no puede pasar.
 *
 * El desempate es el record id más pequeño: se queda con el número y el otro
 * se mueve al siguiente libre. Es determinista, así que las dos peticiones
 * llegan a la misma conclusión sin coordinarse y solo una se mueve.
 */
async function asegurarSerialUnico(
  recordId: string,
  serial: string,
  anio: number,
): Promise<string> {
  let actual = serial;

  for (let intento = 0; intento < INTENTOS_SERIAL; intento += 1) {
    const mismos = await listarRegistros(
      env.baseCotizaciones,
      env.tablaCotizaciones,
      {
        fields: [CAMPOS_COTIZACION.id],
        filterByFormula: `{${CAMPOS_COTIZACION.id}} = '${actual}'`,
      },
    );

    if (mismos.length <= 1) return actual;

    const gana = mismos.reduce(
      (menor, registro) => (registro.id < menor ? registro.id : menor),
      mismos[0].id,
    );
    if (gana === recordId) return actual;

    actual = serialCotizacion(anio, (await ultimoConsecutivo(anio)) + 1);
    await actualizarRegistro(
      env.baseCotizaciones,
      env.tablaCotizaciones,
      recordId,
      { [CAMPOS_COTIZACION.id]: actual },
    );
  }

  // Tres colisiones seguidas no es concurrencia, es algo roto. Se avisa con el
  // serial para poder arreglarlo a mano en vez de dejar un duplicado callado.
  throw new Error(
    `El consecutivo ${actual} quedó duplicado y no pudimos reasignarlo. Revísalo en Airtable antes de emitir el documento.`,
  );
}

/* -------------------------------- Escritura ------------------------------ */

export type LineaNuevaCotizacion = {
  idProductoCore: string;
  producto: string;
  descripcion?: string;
  fichaTecnica?: string;
  cantidad: number;
  unidad?: string;
  precioUnitario: number;
};

export type EntradaCotizacion = {
  idClienteCore: string;
  cliente: string;
  nitCliente?: string;
  idContactoCliente?: string;
  contacto?: string;
  cargoContacto?: string;
  idPersonalCore: string;
  responsable: string;
  titulo: string;
  introduccion?: string;
  /** YYYY-MM-DD. Es la fecha del documento. */
  fechaEmision: string;
  vigenciaDias: number;
  estado: EstadoCotizacion;
  ivaPorcentaje?: number;
  modalidadEntrega?: ModalidadEntrega;
  puntoEntrega?: string;
  valorFlete?: number;
  fechaDespacho?: string;
  fechaEntrega?: string;
  quienRecibe?: string;
  horarioRecibo?: string;
  formaPago?: FormaPago;
  ordenCompra?: string;
  emailFacturacion?: string;
  registroIca?: string;
  observaciones?: string;
  presentacion?: string;
  unidades?: string;
  almacenamiento?: string;
  vidaUtilDias?: number;
  notasInternas?: string;
  lineas: LineaNuevaCotizacion[];
};

/**
 * Emite una cotización con sus renglones.
 *
 * El orden es: reservar el consecutivo creando la cabecera, comprobar que
 * ninguna otra emisión se lo llevó, y solo entonces escribir los renglones —
 * su propio ID depende del consecutivo definitivo, así que crearlos antes
 * dejaría renglones apuntando a un código que ya cambió.
 *
 * Si un renglón falla, la cabecera ya existe: se devuelve el error con el
 * consecutivo para poder completarla a mano, igual que en pedidos. Un
 * registro invisible es peor que uno incompleto que sabemos nombrar.
 */
export async function crearCotizacion(
  entrada: EntradaCotizacion,
): Promise<Cotizacion> {
  const anio = Number(entrada.fechaEmision.slice(0, 4));
  const serialProvisional = serialCotizacion(
    anio,
    (await ultimoConsecutivo(anio)) + 1,
  );

  const fields: Record<string, unknown> = {
    [CAMPOS_COTIZACION.id]: serialProvisional,
    [CAMPOS_COTIZACION.revision]: 0,
    [CAMPOS_COTIZACION.idClienteCore]: entrada.idClienteCore,
    [CAMPOS_COTIZACION.cliente]: entrada.cliente,
    [CAMPOS_COTIZACION.idPersonalCore]: entrada.idPersonalCore,
    [CAMPOS_COTIZACION.responsable]: entrada.responsable,
    [CAMPOS_COTIZACION.titulo]: entrada.titulo,
    [CAMPOS_COTIZACION.fechaEmision]: entrada.fechaEmision,
    [CAMPOS_COTIZACION.vigenciaDias]: entrada.vigenciaDias,
    [CAMPOS_COTIZACION.estado]: entrada.estado,
    [CAMPOS_COTIZACION.fechaCreacion]: new Date().toISOString(),
  };

  // Una oferta que nace enviada se envió hoy: la fecha de envío es el día
  // desde el que se cuenta el seguimiento, y dejarla vacía lo perdería.
  if (entrada.estado === "Enviada") {
    fields[CAMPOS_COTIZACION.fechaEnvio] = entrada.fechaEmision;
  }

  const opcionales: [string, unknown][] = [
    [CAMPOS_COTIZACION.nitCliente, entrada.nitCliente],
    [CAMPOS_COTIZACION.idContactoCliente, entrada.idContactoCliente],
    [CAMPOS_COTIZACION.contacto, entrada.contacto],
    [CAMPOS_COTIZACION.cargoContacto, entrada.cargoContacto],
    [CAMPOS_COTIZACION.introduccion, entrada.introduccion],
    [CAMPOS_COTIZACION.ivaPorcentaje, entrada.ivaPorcentaje],
    [CAMPOS_COTIZACION.modalidadEntrega, entrada.modalidadEntrega],
    [CAMPOS_COTIZACION.puntoEntrega, entrada.puntoEntrega],
    [CAMPOS_COTIZACION.valorFlete, entrada.valorFlete],
    [CAMPOS_COTIZACION.fechaDespacho, entrada.fechaDespacho],
    [CAMPOS_COTIZACION.fechaEntrega, entrada.fechaEntrega],
    [CAMPOS_COTIZACION.quienRecibe, entrada.quienRecibe],
    [CAMPOS_COTIZACION.horarioRecibo, entrada.horarioRecibo],
    [CAMPOS_COTIZACION.formaPago, entrada.formaPago],
    [CAMPOS_COTIZACION.ordenCompra, entrada.ordenCompra],
    [CAMPOS_COTIZACION.emailFacturacion, entrada.emailFacturacion],
    [CAMPOS_COTIZACION.registroIca, entrada.registroIca],
    [CAMPOS_COTIZACION.observaciones, entrada.observaciones],
    [CAMPOS_COTIZACION.presentacion, entrada.presentacion],
    [CAMPOS_COTIZACION.unidades, entrada.unidades],
    [CAMPOS_COTIZACION.almacenamiento, entrada.almacenamiento],
    [CAMPOS_COTIZACION.vidaUtilDias, entrada.vidaUtilDias],
    [CAMPOS_COTIZACION.notasInternas, entrada.notasInternas],
  ];
  for (const [campo, valor] of opcionales) {
    if (valor !== undefined) fields[campo] = valor;
  }

  const registro = await crearRegistro(
    env.baseCotizaciones,
    env.tablaCotizaciones,
    fields,
  );

  const serial = await asegurarSerialUnico(
    registro.id,
    serialProvisional,
    anio,
  );

  let orden = 0;
  for (const linea of entrada.lineas) {
    orden += 1;
    try {
      await crearRegistro(env.baseCotizaciones, env.tablaDetallesCotizacion, {
        [CAMPOS_DETALLE.id]: serialLinea(serial, orden),
        [CAMPOS_DETALLE.cotizacion]: [registro.id],
        [CAMPOS_DETALLE.orden]: orden,
        [CAMPOS_DETALLE.idProductoCore]: linea.idProductoCore,
        [CAMPOS_DETALLE.producto]: linea.producto,
        [CAMPOS_DETALLE.descripcion]: linea.descripcion ?? "",
        [CAMPOS_DETALLE.fichaTecnica]: linea.fichaTecnica ?? "",
        [CAMPOS_DETALLE.cantidad]: linea.cantidad,
        [CAMPOS_DETALLE.unidad]: linea.unidad ?? "",
        [CAMPOS_DETALLE.precioUnitario]: linea.precioUnitario,
      });
    } catch (error) {
      console.error("crear detalle de cotizacion", error);
      throw new Error(
        `La cotización ${serial} quedó creada, pero un renglón no se pudo guardar. Revísala en Airtable antes de emitir el documento.`,
      );
    }
  }

  const completa = await obtenerCotizacion(registro.id);
  return completa ?? aCotizacion(registro, []);
}

export type CambiosCotizacion = {
  estado?: EstadoCotizacion;
  /** YYYY-MM-DD; se escribe al pasar a Enviada. */
  fechaEnvio?: string;
  /** YYYY-MM-DD; se escribe al aceptar o rechazar. */
  fechaCierre?: string;
  motivoCierre?: string;
  modificadoPor: string;
};

/**
 * Mueve una cotización de estado y deja la traza de cuándo.
 *
 * Es el único cambio que el CRM hace sobre una cotización ya emitida: el
 * contenido no se edita, porque cambiarlo callado convertiría el documento
 * controlado en un papel que dice algo distinto de lo que se envió.
 */
export async function actualizarCotizacion(
  recordId: string,
  cambios: CambiosCotizacion,
): Promise<Cotizacion> {
  const fields: Record<string, unknown> = {
    [CAMPOS_COTIZACION.modificadoPor]: cambios.modificadoPor,
  };

  if (cambios.estado !== undefined) {
    fields[CAMPOS_COTIZACION.estado] = cambios.estado;
  }
  if (cambios.fechaEnvio !== undefined) {
    fields[CAMPOS_COTIZACION.fechaEnvio] = cambios.fechaEnvio;
  }
  if (cambios.fechaCierre !== undefined) {
    fields[CAMPOS_COTIZACION.fechaCierre] = cambios.fechaCierre;
  }
  if (cambios.motivoCierre !== undefined) {
    fields[CAMPOS_COTIZACION.motivoCierre] = cambios.motivoCierre;
  }

  const registro = await actualizarRegistro(
    env.baseCotizaciones,
    env.tablaCotizaciones,
    recordId,
    fields,
  );

  const actualizada = await obtenerCotizacion(registro.id);
  return actualizada ?? aCotizacion(registro, []);
}
