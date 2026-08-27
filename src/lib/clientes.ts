import { listarRegistros, texto, type AirtableRecord } from "@/lib/airtable";
import { env } from "@/lib/env";

/**
 * Base "Sirius Clients Core": el maestro de clientes, su personal de contacto
 * y los cultivos que tienen sembrados. Las visitas y los casos viven en la
 * base del CRM y se cruzan desde `@/lib/crm`.
 */

const CAMPOS_CLIENTE = {
  id: "ID",
  nombre: "Cliente",
  nit: "Nit",
  direccion: "Direccion",
  ciudad: "Ciudad",
  departamento: "Departamento",
  estado: "Estado Cliente",
  coordenadas: "coordenadas_gps",
  distancia: "distancia_bodega_km",
  creado: "Fecha de creacion",
} as const;

const CAMPOS_CONTACTO = {
  codigo: "Codigo Persona Cliente",
  nombre: "Nombre Completo",
  cargo: "Cargo",
  cedula: "Cedula",
  email: "Email",
  emailNotificacion: "Email Notificacion",
  telefono: "Teléfono",
  cliente: "Cliente",
  estado: "Estado Personal",
} as const;

const CAMPOS_CULTIVO = {
  id: "ID",
  nombre: "nombre_cultivo",
  cliente: "cliente_id",
  tipo: "tipo_cultivo",
  estado: "estado",
  tecnico: "tecnico_responsable",
  lotes: "Recuento (lotes_asociados)",
} as const;

export type Cliente = {
  recordId: string;
  /** Serial legible, formato CL-000X. Es el que guardan las visitas. */
  id: string;
  nombre: string;
  nit: string | null;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  estado: string | null;
  activo: boolean;
  coordenadas: string | null;
  distanciaBodegaKm: number | null;
  creado: string | null;
};

export type ContactoCliente = {
  recordId: string;
  codigo: string | null;
  nombre: string;
  cargo: string | null;
  email: string | null;
  emailNotificacion: string | null;
  telefono: string | null;
  activo: boolean;
  clientes: string[];
};

export type CultivoCliente = {
  recordId: string;
  id: string | null;
  nombre: string;
  tipo: string | null;
  estado: string | null;
  tecnico: string | null;
  lotes: number;
  clientes: string[];
};

/**
 * En Airtable varias celdas traen "N/A" escrito a mano en lugar de quedar
 * vacías; para la interfaz es lo mismo que no tener dato.
 */
function textoLimpio(value: unknown): string | null {
  const valor = texto(value);
  if (!valor) return null;
  const normalizado = valor.toUpperCase().replace(/[.\s]/g, "");
  return normalizado === "NA" || normalizado === "NINGUNO" ? null : valor;
}

/** Igual que `texto`, pero para celdas numéricas (una cadena vacía no es 0). */
function numero(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Los campos de vínculo devuelven un arreglo de record ids. */
function vinculos(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function aCliente(record: AirtableRecord): Cliente {
  const f = record.fields;
  const estado = texto(f[CAMPOS_CLIENTE.estado]);

  return {
    recordId: record.id,
    id: texto(f[CAMPOS_CLIENTE.id]) ?? "",
    nombre: texto(f[CAMPOS_CLIENTE.nombre]) ?? "",
    nit: textoLimpio(f[CAMPOS_CLIENTE.nit]),
    direccion: textoLimpio(f[CAMPOS_CLIENTE.direccion]),
    ciudad: textoLimpio(f[CAMPOS_CLIENTE.ciudad]),
    departamento: textoLimpio(f[CAMPOS_CLIENTE.departamento]),
    estado,
    activo: estado !== "Inactivo",
    coordenadas: textoLimpio(f[CAMPOS_CLIENTE.coordenadas]),
    distanciaBodegaKm: numero(f[CAMPOS_CLIENTE.distancia]),
    creado: texto(f[CAMPOS_CLIENTE.creado]),
  };
}

/** Todos los clientes, activos e inactivos, para el listado del módulo. */
export async function listarClientesCompletos(): Promise<Cliente[]> {
  const registros = await listarRegistros(env.baseClientes, env.tablaClientes, {
    fields: Object.values(CAMPOS_CLIENTE),
  });

  return registros
    .map(aCliente)
    .filter((cliente) => cliente.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function obtenerCliente(recordId: string): Promise<Cliente | null> {
  const registros = await listarRegistros(env.baseClientes, env.tablaClientes, {
    fields: Object.values(CAMPOS_CLIENTE),
    filterByFormula: `RECORD_ID() = '${recordId}'`,
    maxRecords: 1,
  });

  return registros[0] ? aCliente(registros[0]) : null;
}

export async function listarContactos(): Promise<ContactoCliente[]> {
  const registros = await listarRegistros(
    env.baseClientes,
    env.tablaPersonalCliente,
    { fields: Object.values(CAMPOS_CONTACTO) },
  );

  return registros
    .map((registro) => {
      const f = registro.fields;
      return {
        recordId: registro.id,
        codigo: texto(f[CAMPOS_CONTACTO.codigo]),
        nombre: texto(f[CAMPOS_CONTACTO.nombre]) ?? "",
        cargo: texto(f[CAMPOS_CONTACTO.cargo]),
        email: texto(f[CAMPOS_CONTACTO.email]),
        emailNotificacion: texto(f[CAMPOS_CONTACTO.emailNotificacion]),
        telefono: texto(f[CAMPOS_CONTACTO.telefono]),
        activo: texto(f[CAMPOS_CONTACTO.estado]) !== "Inactivo",
        clientes: vinculos(f[CAMPOS_CONTACTO.cliente]),
      };
    })
    .filter((contacto) => contacto.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function listarCultivos(): Promise<CultivoCliente[]> {
  const registros = await listarRegistros(env.baseClientes, env.tablaCultivos, {
    fields: Object.values(CAMPOS_CULTIVO),
  });

  return registros
    .map((registro) => {
      const f = registro.fields;
      return {
        recordId: registro.id,
        id: texto(f[CAMPOS_CULTIVO.id]),
        nombre: texto(f[CAMPOS_CULTIVO.nombre]) ?? "Sin nombre",
        tipo: texto(f[CAMPOS_CULTIVO.tipo]),
        estado: texto(f[CAMPOS_CULTIVO.estado]),
        tecnico: texto(f[CAMPOS_CULTIVO.tecnico]),
        lotes: numero(f[CAMPOS_CULTIVO.lotes]) ?? 0,
        clientes: vinculos(f[CAMPOS_CULTIVO.cliente]),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/* ------------------------- Selector del formulario ----------------------- */

export type ClienteCore = {
  recordId: string;
  id: string;
  nombre: string;
  ciudad: string | null;
  departamento: string | null;
};

/** Solo los activos: es la lista que alimenta el autocompletar de Visitas. */
export async function listarClientes(): Promise<ClienteCore[]> {
  const clientes = await listarClientesCompletos();

  return clientes
    .filter((cliente) => cliente.activo)
    .map((cliente) => ({
      recordId: cliente.recordId,
      id: cliente.id,
      nombre: cliente.nombre,
      ciudad: cliente.ciudad,
      departamento: cliente.departamento,
    }));
}
