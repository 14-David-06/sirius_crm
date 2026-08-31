/**
 * Lo que del catálogo comparten el cliente y el servidor: las opciones de los
 * selects y el formato de precio. Vive aparte de `productos.ts` para que los
 * componentes `"use client"` no arrastren la capa de Airtable al navegador.
 */

export const CATEGORIAS_PRODUCTO = [
  "Microbiología agrícola",
  "Mezcla biológica",
  "Enmienda orgánica",
] as const;

export const TIPOS_PRODUCTO = [
  "Hongo",
  "Bacteria",
  "Experimento",
  "Fertilizante",
] as const;

export const UNIDADES_PRODUCTO = ["L", "Kg", "Bolsa", "Unidad"] as const;

export const AREAS_PRODUCTO = ["Pirolisis", "Laboratorio"] as const;

export const CATEGORIAS_CP_CN = [
  "Crop Protection",
  "Crop Nutrition",
  "N/A",
] as const;

export type CategoriaProducto = (typeof CATEGORIAS_PRODUCTO)[number];
export type TipoProducto = (typeof TIPOS_PRODUCTO)[number];
export type UnidadProducto = (typeof UNIDADES_PRODUCTO)[number];
export type AreaProducto = (typeof AREAS_PRODUCTO)[number];
export type CategoriaCpCn = (typeof CATEGORIAS_CP_CN)[number];

const PESOS = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Precio con su unidad: "$45.000 / L". Sin precio no inventa un cero. */
export function formatearPrecio(
  precio: number | null,
  unidad: string | null,
): string {
  if (precio === null) return "—";
  return unidad ? `${PESOS.format(precio)} / ${unidad}` : PESOS.format(precio);
}

/**
 * Lee un precio que llega del formulario: null si viene vacío (sin asignar)
 * y "invalido" si no es un número usable. El cero es un precio legítimo —
 * las muestras y los ensayos van en cero.
 */
export function leerPrecio(valor: unknown): number | null | "invalido" {
  if (valor === undefined || valor === null || valor === "") return null;

  const numero = typeof valor === "number" ? valor : Number(String(valor));
  if (!Number.isFinite(numero) || numero < 0) return "invalido";

  return numero;
}

/**
 * Cruza los códigos que un registro guardó como texto ("SIRIUS-PRODUCT-0001,
 * SIRIUS-PRODUCT-0004") con el catálogo, y devuelve los que siguen existiendo.
 *
 * El catálogo que se le pasa tiene que ser el **completo**, con los
 * descontinuados incluidos. Cruzar solo contra los vigentes borraría del
 * registro histórico un producto que se descontinuó después: el catálogo nunca
 * borra un producto con historial, y esto es la otra mitad de esa regla.
 */
export function codigosDelCatalogo(
  guardados: string | null,
  catalogo: { codigo: string }[],
): string[] {
  const pedidos = new Set(
    (guardados ?? "")
      .split(",")
      .map((codigo) => codigo.trim())
      .filter(Boolean),
  );

  // Se recorre el catálogo, no lo guardado, para que el orden sea estable.
  return catalogo
    .filter((producto) => pedidos.has(producto.codigo))
    .map((producto) => producto.codigo);
}
