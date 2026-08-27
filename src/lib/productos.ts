import {
  actualizarRegistro,
  crearRegistro,
  listarRegistros,
  texto,
  type AirtableRecord,
} from "@/lib/airtable";
import { env } from "@/lib/env";

/**
 * Base "Sirius Product Core": el catálogo comercial. Vive aparte de la base
 * del CRM, así que solo se cruza por el código del producto que las visitas
 * guardan en "ID Productos Core".
 */

const CAMPOS_PRODUCTO = {
  codigo: "Codigo Producto",
  nombre: "Nombre Comercial",
  abreviatura: "Abreviatura",
  categoria: "Categoria Producto",
  categoriaCpCn: "Categoria Producto CP-CN",
  tipo: "Tipo Producto",
  unidad: "Unidad Base",
  precio: "Precio Venta Unitario",
  area: "Area",
  version: "Version",
  observaciones: "Observaciones",
  activo: "Activo",
  creado: "Fecha Creacion",
} as const;

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

export type Producto = {
  recordId: string;
  codigo: string;
  nombre: string;
  abreviatura: string | null;
  categoria: string | null;
  categoriaCpCn: string | null;
  tipo: string | null;
  unidad: string | null;
  /** null es "sin precio asignado"; 0 es un precio real (muestras, ensayos). */
  precio: number | null;
  area: string | null;
  version: string | null;
  observaciones: string | null;
  activo: boolean;
  creado: string | null;
};

function numero(valor: unknown): number | null {
  return typeof valor === "number" ? valor : null;
}

function aProducto(registro: AirtableRecord): Producto {
  const f = registro.fields;

  return {
    recordId: registro.id,
    codigo: texto(f[CAMPOS_PRODUCTO.codigo]) ?? "",
    nombre: texto(f[CAMPOS_PRODUCTO.nombre]) ?? "",
    abreviatura: texto(f[CAMPOS_PRODUCTO.abreviatura]),
    categoria: texto(f[CAMPOS_PRODUCTO.categoria]),
    categoriaCpCn: texto(f[CAMPOS_PRODUCTO.categoriaCpCn]),
    tipo: texto(f[CAMPOS_PRODUCTO.tipo]),
    unidad: texto(f[CAMPOS_PRODUCTO.unidad]),
    precio: numero(f[CAMPOS_PRODUCTO.precio]),
    area: texto(f[CAMPOS_PRODUCTO.area]),
    version: texto(f[CAMPOS_PRODUCTO.version]),
    observaciones: texto(f[CAMPOS_PRODUCTO.observaciones]),
    // El campo es un select "Sí | No": solo "No" desactiva.
    activo: texto(f[CAMPOS_PRODUCTO.activo]) !== "No",
    creado: texto(f[CAMPOS_PRODUCTO.creado]),
  };
}

/** Todo el catálogo, activo e inactivo, para el módulo de Productos. */
export async function listarProductos(): Promise<Producto[]> {
  const registros = await listarRegistros(
    env.baseProductos,
    env.tablaProductos,
    { fields: Object.values(CAMPOS_PRODUCTO) },
  );

  return registros
    .map(aProducto)
    .filter((producto) => producto.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Solo los vigentes: es la lista que se ofrece al registrar una visita. */
export async function listarProductosActivos(): Promise<Producto[]> {
  const productos = await listarProductos();
  return productos.filter((producto) => producto.activo);
}

export type EntradaProducto = {
  nombre: string;
  categoria: CategoriaProducto;
  tipo: TipoProducto;
  unidad: UnidadProducto;
  abreviatura?: string;
  categoriaCpCn?: CategoriaCpCn;
  area?: AreaProducto;
  version?: string;
  precio?: number;
  observaciones?: string;
};

export async function crearProducto(
  entrada: EntradaProducto,
): Promise<Producto> {
  const fields: Record<string, unknown> = {
    [CAMPOS_PRODUCTO.nombre]: entrada.nombre,
    [CAMPOS_PRODUCTO.categoria]: entrada.categoria,
    [CAMPOS_PRODUCTO.tipo]: entrada.tipo,
    [CAMPOS_PRODUCTO.unidad]: entrada.unidad,
    [CAMPOS_PRODUCTO.abreviatura]: entrada.abreviatura ?? "",
    [CAMPOS_PRODUCTO.version]: entrada.version ?? "",
    [CAMPOS_PRODUCTO.observaciones]: entrada.observaciones ?? "",
    [CAMPOS_PRODUCTO.activo]: "Sí",
  };

  // Los selects vacíos y el precio ausente se omiten en vez de mandarse en
  // blanco: Airtable rechaza "" como opción de un singleSelect.
  if (entrada.categoriaCpCn) {
    fields[CAMPOS_PRODUCTO.categoriaCpCn] = entrada.categoriaCpCn;
  }
  if (entrada.area) {
    fields[CAMPOS_PRODUCTO.area] = entrada.area;
  }
  if (entrada.precio !== undefined) {
    fields[CAMPOS_PRODUCTO.precio] = entrada.precio;
  }

  const registro = await crearRegistro(
    env.baseProductos,
    env.tablaProductos,
    fields,
  );
  return aProducto(registro);
}

/** El precio de lista es lo que más cambia; null lo deja sin asignar. */
export async function actualizarPrecio(
  recordId: string,
  precio: number | null,
): Promise<Producto> {
  const registro = await actualizarRegistro(
    env.baseProductos,
    env.tablaProductos,
    recordId,
    { [CAMPOS_PRODUCTO.precio]: precio },
  );
  return aProducto(registro);
}

export async function cambiarEstadoProducto(
  recordId: string,
  activo: boolean,
): Promise<Producto> {
  const registro = await actualizarRegistro(
    env.baseProductos,
    env.tablaProductos,
    recordId,
    { [CAMPOS_PRODUCTO.activo]: activo ? "Sí" : "No" },
  );
  return aProducto(registro);
}

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
