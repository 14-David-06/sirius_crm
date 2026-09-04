/**
 * Lo que de las cotizaciones comparten el cliente y el servidor: las opciones
 * de los selects, la aritmética del documento y los filtros del panel. Vive
 * aparte de `cotizaciones.ts` para que los componentes `"use client"` no
 * arrastren la capa de Airtable al navegador.
 *
 * El dinero y las cantidades se formatean con las funciones de
 * `pedidos-comun`: son las mismas cifras en los mismos pesos, y una segunda
 * copia del formato es una segunda copia que se desalinea.
 */

export { formatearCantidad, formatearPesos, leerCantidad } from "@/lib/pedidos-comun";

/* -------------------------------- Opciones -------------------------------- */

export const ESTADOS_COTIZACION = [
  "Borrador",
  "Enviada",
  "Aceptada",
  "Rechazada",
  "Vencida",
  "Anulada",
] as const;

export const MODALIDADES_ENTREGA = [
  "Sirius entrega en el punto acordado",
  "El cliente recoge en planta",
  "Envio por transportadora",
] as const;

export const FORMAS_PAGO = [
  "Anticipado 100 % antes del despacho",
  "50 % anticipo · 50 % contra entrega",
  "Credito a 30 dias",
  "Credito a 45 dias",
] as const;

export type EstadoCotizacion = (typeof ESTADOS_COTIZACION)[number];
export type ModalidadEntrega = (typeof MODALIDADES_ENTREGA)[number];
export type FormaPago = (typeof FORMAS_PAGO)[number];

/** Lo que cada modalidad implica para el flete; se imprime bajo la opción. */
export const NOTA_MODALIDAD: Record<ModalidadEntrega, string> = {
  "Sirius entrega en el punto acordado":
    "Flete a cargo de Sirius, facturado aparte según destino.",
  "El cliente recoge en planta":
    "Km 7 Vía Cabuyaro, Barranca de Upía, Meta. Sin costo de flete.",
  "Envio por transportadora": "Flete pagado en destino por el cliente.",
};

/**
 * Una cotización cerrada ya tomó su decisión: no cambia de estado ni se
 * reedita. Para cambiar algo se emite una revisión, que es otro documento con
 * el mismo consecutivo.
 */
const CERRADAS = new Set<string>([
  "Aceptada",
  "Rechazada",
  "Vencida",
  "Anulada",
]);

export function estaCerradaCotizacion(estado: string | null): boolean {
  return estado !== null && CERRADAS.has(estado);
}

/**
 * A qué estados puede moverse una cotización.
 *
 * A diferencia de un pedido, aquí el orden importa: una oferta que el cliente
 * nunca recibió no puede estar "Aceptada". Dejar el salto libre convertiría el
 * embudo en un dato que no se puede leer.
 */
export function siguientesEstadosCotizacion(
  estado: string | null,
): EstadoCotizacion[] {
  if (estado === "Borrador") return ["Enviada", "Anulada"];
  if (estado === "Enviada") {
    return ["Aceptada", "Rechazada", "Vencida", "Anulada"];
  }
  return [];
}

/** Los estados con los que puede nacer una cotización. */
export const ESTADOS_INICIALES_COTIZACION = [
  "Borrador",
  "Enviada",
] as const satisfies readonly EstadoCotizacion[];

/** Cerrar por decisión del cliente exige decir cuándo se cerró. */
export function cierraCotizacion(estado: string): boolean {
  return estado === "Aceptada" || estado === "Rechazada";
}

/* ------------------------------- Vigencia -------------------------------- */

/**
 * Hasta cuándo está en firme la oferta.
 *
 * Se calcula y no se guarda: un campo aparte podría contradecir a la fecha de
 * emisión y a los días de vigencia, y en un documento controlado la
 * contradicción es lo que no se puede permitir. La suma va en UTC porque las
 * fechas son `YYYY-MM-DD` sin hora; pasar por la zona local correría un día.
 */
export function vencimientoDe(
  emision: string | null,
  vigenciaDias: number | null,
): string | null {
  if (!emision || vigenciaDias === null || !Number.isFinite(vigenciaDias)) {
    return null;
  }

  const [anio, mes, dia] = emision.slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return null;

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + vigenciaDias);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Si la oferta ya se pasó de su vigencia. El día del vencimiento todavía
 * cuenta como vigente: "válida hasta el 3 de octubre" incluye ese día.
 *
 * Sin fecha de emisión o sin vigencia no se afirma nada: una oferta a la que
 * le falta el dato no está vencida, está incompleta.
 */
export function estaVencidaPorFecha(
  emision: string | null,
  vigenciaDias: number | null,
  hoy: string,
): boolean {
  const vence = vencimientoDe(emision, vigenciaDias);
  return vence !== null && hoy > vence;
}

/* -------------------------------- Totales -------------------------------- */

export type LineaMonetaria = { cantidad: number; precioUnitario: number };

export type Totales = {
  subtotal: number;
  /** null cuando el IVA está por confirmar; 0 solo si el IVA es realmente 0 %. */
  iva: number | null;
  /** El subtotal cuando el IVA está por confirmar: nunca se asume exento. */
  total: number;
};

/**
 * La aritmética de la oferta.
 *
 * El IVA sin definir no es cero. El formato lo dice explícitamente —"% a
 * confirmar con facturación"— y tratarlo como cero imprimiría un total en
 * firme que nadie autorizó. Por eso `iva` es `null` y no `0`, y el total
 * declara que le falta ese renglón.
 */
export function totalesDe(
  lineas: LineaMonetaria[],
  ivaPorcentaje: number | null,
): Totales {
  const subtotal = lineas.reduce(
    (suma, linea) => suma + linea.cantidad * linea.precioUnitario,
    0,
  );

  if (ivaPorcentaje === null || !Number.isFinite(ivaPorcentaje)) {
    return { subtotal, iva: null, total: subtotal };
  }

  // Se redondea el IVA y no el total: es la cifra que va en la factura.
  const iva = Math.round((subtotal * ivaPorcentaje) / 100);
  return { subtotal, iva, total: subtotal + iva };
}

/* ------------------------------ Consecutivo ------------------------------ */

/**
 * El consecutivo controlado del documento: `COT-2026-004`.
 *
 * Tres dígitos porque es lo que usa el formato en papel; si un año pasara de
 * 999 ofertas el número crece en vez de truncarse — perder un dígito
 * duplicaría consecutivos, que en un documento controlado es peor que un
 * código más largo.
 */
export function serialCotizacion(anio: number, consecutivo: number): string {
  return `COT-${anio}-${String(consecutivo).padStart(3, "0")}`;
}

/** El año y el número de un consecutivo ya emitido, o null si no tiene forma. */
export function leerSerialCotizacion(
  serial: string | null,
): { anio: number; consecutivo: number } | null {
  const partes = /^COT-(\d{4})-(\d+)$/.exec(serial?.trim() ?? "");
  if (!partes) return null;
  return { anio: Number(partes[1]), consecutivo: Number(partes[2]) };
}

/** El consecutivo del renglón: `COT-2026-004-L1`. */
export function serialLinea(serial: string, orden: number): string {
  return `${serial}-L${orden}`;
}

/** "Rev. 00". La revisión se guarda como número y se imprime con dos dígitos. */
export function formatearRevision(revision: number | null): string {
  return `Rev. ${String(revision ?? 0).padStart(2, "0")}`;
}

/** "30 días · hasta el 3 de octubre de 2026", como lo imprime el documento. */
export function formatearVigencia(
  emision: string | null,
  vigenciaDias: number | null,
): string {
  if (vigenciaDias === null) return "Por definir";

  const vence = vencimientoDe(emision, vigenciaDias);
  const dias = `${vigenciaDias} ${vigenciaDias === 1 ? "día" : "días"}`;
  return vence ? `${dias} · hasta el ${formatearFechaLarga(vence)}` : dias;
}

const MESES_LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * "3 de septiembre de 2026". El documento impreso no usa la fecha corta del
 * panel: es una oferta comercial, no una fila de tabla.
 *
 * Se parte el texto en vez de pasar por `Date` para no correr el día según la
 * zona del navegador, igual que `formatearFecha` en `@/lib/fechas`.
 */
export function formatearFechaLarga(fecha: string | null): string {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return fecha;
  return `${dia} de ${MESES_LARGOS[mes - 1]} de ${anio}`;
}

/* -------------------------- Filtros del panel ---------------------------- */

/** Lo mínimo de una cotización que hace falta para decidir si pasa los filtros. */
export type CotizacionFiltrable = {
  id: string;
  cliente: string;
  titulo: string | null;
  estado: string | null;
  /** YYYY-MM-DD, o null si el registro no la trae. */
  fechaEmision: string | null;
  responsable: string | null;
  observaciones: string | null;
  notasInternas: string | null;
  lineas: { producto: string }[];
  /** Si ya se pasó de su vigencia, según la fecha de hoy. */
  vencida: boolean;
};

export type FiltrosCotizacion = {
  /** Texto libre; se busca en cliente, código, título, productos y notas. */
  termino: string;
  /**
   * Un estado concreto, o uno de los agregados: "abiertas", "cerradas",
   * "por-vencer", "todos".
   */
  estado: string;
  cliente: string;
  producto: string;
  responsable: string;
  /** Rango inclusivo por fecha de emisión; "" desactiva ese extremo. */
  desde: string;
  hasta: string;
};

export const FILTROS_COTIZACION_VACIOS: FiltrosCotizacion = {
  termino: "",
  estado: "abiertas",
  cliente: "",
  producto: "",
  responsable: "",
  desde: "",
  hasta: "",
};

/**
 * Si una cotización pasa los filtros del panel.
 *
 * Vive aquí y no dentro del componente por lo mismo que en pedidos: una
 * cotización sin fecha, un rango invertido o un producto que solo está en uno
 * de varios renglones no se ven en la pantalla, se ven en una prueba.
 */
export function coincideCotizacion(
  cotizacion: CotizacionFiltrable,
  filtros: FiltrosCotizacion,
): boolean {
  const termino = filtros.termino.trim().toLowerCase();
  if (termino) {
    const texto = [
      cotizacion.cliente,
      cotizacion.id,
      cotizacion.titulo ?? "",
      cotizacion.responsable ?? "",
      cotizacion.observaciones ?? "",
      cotizacion.notasInternas ?? "",
      ...cotizacion.lineas.map((linea) => linea.producto),
    ]
      .join(" ")
      .toLowerCase();
    if (!texto.includes(termino)) return false;
  }

  const cerrada = estaCerradaCotizacion(cotizacion.estado);
  if (filtros.estado === "abiertas" && cerrada) return false;
  if (filtros.estado === "cerradas" && !cerrada) return false;
  // Una oferta vencida que nadie cerró es la que hay que perseguir: sigue
  // abierta en el sistema pero ya no está en firme.
  if (filtros.estado === "por-vencer" && (cerrada || !cotizacion.vencida)) {
    return false;
  }
  if (
    ESTADOS_COTIZACION.includes(filtros.estado as EstadoCotizacion) &&
    cotizacion.estado !== filtros.estado
  ) {
    return false;
  }

  if (filtros.cliente && cotizacion.cliente !== filtros.cliente) return false;

  if (
    filtros.producto &&
    !cotizacion.lineas.some((linea) => linea.producto === filtros.producto)
  ) {
    return false;
  }

  if (
    filtros.responsable &&
    cotizacion.responsable !== filtros.responsable
  ) {
    return false;
  }

  // Sin fecha no se puede afirmar que está dentro del rango, así que sale en
  // cuanto se pide uno. Sin rango sigue apareciendo.
  if (
    filtros.desde &&
    (!cotizacion.fechaEmision || cotizacion.fechaEmision < filtros.desde)
  ) {
    return false;
  }
  if (
    filtros.hasta &&
    (!cotizacion.fechaEmision || cotizacion.fechaEmision > filtros.hasta)
  ) {
    return false;
  }

  return true;
}

/* --------------------------- Textos del emisor --------------------------- */

/**
 * Quién emite. Es la propia empresa, así que no es un dato de Airtable: si
 * cambia el NIT o la sede, cambia aquí y con eso cambian todos los documentos.
 */
export const EMISOR = {
  razonSocial: "Sirius Regenerative Solutions S.A.S. ZOMAC",
  nit: "NIT 901.377.064-8",
  direccion: "Km 7 Vía Cabuyaro",
  ciudad: "Barranca de Upía, Meta · Colombia",
} as const;

/** El texto legal al pie. El consecutivo se inserta al imprimir. */
export function textoLegal(serial: string): string {
  return (
    "Esta cotización constituye la oferta comercial en firme de Sirius para las " +
    "cantidades y condiciones indicadas, válida durante su vigencia. Valores en " +
    "pesos colombianos. Documento controlado bajo el consecutivo " +
    `${serial}; toda modificación se emite como nueva revisión. Prohibida su ` +
    "reproducción parcial sin autorización escrita."
  );
}

/** Lo que el formato dice del almacenamiento cuando nadie lo cambia. */
export const ALMACENAMIENTO_POR_DEFECTO =
  "Lugar fresco, seco y a la sombra. No exponer al sol directo.";

/** Los días de vigencia con los que nace una oferta si nadie los toca. */
export const VIGENCIA_POR_DEFECTO = 30;
