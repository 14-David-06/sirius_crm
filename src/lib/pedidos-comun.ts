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
