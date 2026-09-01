/**
 * Lo que de los pedidos comparten el cliente y el servidor: las opciones de
 * los selects y el formato de dinero. Vive aparte de `pedidos.ts` para que los
 * componentes `"use client"` no arrastren la capa de Airtable al navegador.
 *
 * Las listas replican los selects de Sirius Pedidos Core tal como están hoy.
 * Esa base la comparten DataLab y PiroliApp, así que no se inventan opciones:
 * si falta una, se agrega primero en Airtable.
 */

export const ESTADOS_PEDIDO = [
  "Recibido",
  "Procesando",
  "Enviado Parcial",
  "Enviado",
  "Completado",
  "Cancelado",
] as const;

export const CATEGORIAS_APLICACION = [
  "Preventivo Marchitez Letal (ML)",
  "Preventivo Control Plagas",
  "Preventivo PC",
  "Preventivo Pestalotiopsis",
  "Otro",
] as const;

export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];
export type CategoriaAplicacion = (typeof CATEGORIAS_APLICACION)[number];

/** Un pedido cerrado ya no se toca: ni se despacha ni cambia de estado. */
const CERRADOS = new Set<string>(["Completado", "Cancelado"]);

export function estaCerradoPedido(estado: string | null): boolean {
  return estado !== null && CERRADOS.has(estado);
}

/** Estados a los que se puede mover un pedido abierto, sin saltos raros. */
export function siguientesEstados(estado: string | null): EstadoPedido[] {
  if (estaCerradoPedido(estado)) return [];
  return ESTADOS_PEDIDO.filter((siguiente) => siguiente !== estado);
}

const PESOS = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatearPesos(valor: number | null): string {
  return valor === null ? "—" : PESOS.format(valor);
}

const CANTIDADES = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
});

export function formatearCantidad(valor: number): string {
  return CANTIDADES.format(valor);
}

/**
 * Lee una cantidad del formulario. A diferencia del precio, el cero no es
 * válido: un renglón de pedido sin cantidad no es un renglón.
 */
export function leerCantidad(valor: unknown): number | "invalido" {
  if (valor === undefined || valor === null || valor === "") return "invalido";

  const numero = typeof valor === "number" ? valor : Number(String(valor));
  if (!Number.isFinite(numero) || numero <= 0) return "invalido";

  return numero;
}

/* -------------------------- Filtros del panel ---------------------------- */

/** Lo mínimo de un pedido que hace falta para decidir si pasa los filtros. */
export type PedidoFiltrable = {
  id: string;
  cliente: string;
  estado: string | null;
  /** YYYY-MM-DD, o null si el registro no la trae. */
  fecha: string | null;
  notas: string | null;
  responsable: string | null;
  lineas: { producto: string }[];
  remisiones: unknown[];
};

export type FiltrosPedido = {
  /** Texto libre; se busca en cliente, código, notas, responsable y productos. */
  termino: string;
  /**
   * Un estado concreto, o uno de los agregados: "abiertos", "cerrados",
   * "sin-despachar", "todos".
   */
  estado: string;
  cliente: string;
  producto: string;
  responsable: string;
  /** Rango inclusivo por fecha del pedido; "" desactiva ese extremo. */
  desde: string;
  hasta: string;
};

export const FILTROS_PEDIDO_VACIOS: FiltrosPedido = {
  termino: "",
  estado: "abiertos",
  cliente: "",
  producto: "",
  responsable: "",
  desde: "",
  hasta: "",
};

/**
 * Si un pedido pasa los filtros del panel.
 *
 * Vive aquí y no dentro del componente porque es la parte del panel que se
 * puede equivocar en silencio: un pedido sin fecha, un rango invertido o un
 * producto que solo está en un renglón de varios no se ven en la pantalla,
 * se ven en una prueba.
 */
export function coincidePedido(
  pedido: PedidoFiltrable,
  filtros: FiltrosPedido,
): boolean {
  const termino = filtros.termino.trim().toLowerCase();
  if (termino) {
    const texto = [
      pedido.cliente,
      pedido.id,
      pedido.notas ?? "",
      pedido.responsable ?? "",
      ...pedido.lineas.map((linea) => linea.producto),
    ]
      .join(" ")
      .toLowerCase();
    if (!texto.includes(termino)) return false;
  }

  const cerrado = estaCerradoPedido(pedido.estado);
  if (filtros.estado === "abiertos" && cerrado) return false;
  if (filtros.estado === "cerrados" && !cerrado) return false;
  if (filtros.estado === "sin-despachar") {
    if (cerrado || pedido.remisiones.length > 0) return false;
  }
  if (
    ESTADOS_PEDIDO.includes(filtros.estado as EstadoPedido) &&
    pedido.estado !== filtros.estado
  ) {
    return false;
  }

  if (filtros.cliente && pedido.cliente !== filtros.cliente) return false;

  if (
    filtros.producto &&
    !pedido.lineas.some((linea) => linea.producto === filtros.producto)
  ) {
    return false;
  }

  if (filtros.responsable && pedido.responsable !== filtros.responsable) {
    return false;
  }

  // Un pedido sin fecha no puede afirmarse dentro del rango, así que sale en
  // cuanto se pide uno. Sin rango sigue apareciendo.
  if (filtros.desde && (!pedido.fecha || pedido.fecha < filtros.desde)) {
    return false;
  }
  if (filtros.hasta && (!pedido.fecha || pedido.fecha > filtros.hasta)) {
    return false;
  }

  return true;
}
