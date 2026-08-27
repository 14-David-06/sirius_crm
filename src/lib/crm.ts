import {
  actualizarRegistro,
  crearRegistro,
  listarRegistros,
  texto,
  type AirtableRecord,
} from "@/lib/airtable";
import { env } from "@/lib/env";

/**
 * Los nombres de campo replican la hoja "Visitas" del archivo
 * "2026 Gestión de Clientes Sirius" tal como quedó modelada en
 * Airtable (base Sirius CRM, tabla Visitas).
 */
export const CAMPOS_VISITA = {
  id: "ID",
  serial: "Codigo Serial",
  idClienteCore: "ID Cliente Core",
  cliente: "Cliente",
  fecha: "Fecha Visita",
  responsable: "Responsable Comercial",
  tipo: "Tipo de Visita",
  objetivo: "Objetivo de la Visita",
  necesidad: "Necesidad o Diagnóstico",
  idProductosCore: "ID Productos Core",
  productos: "Productos de Interés",
  resultado: "Resultado",
  proximaAccion: "Próxima Acción",
  fechaSeguimiento: "Fecha Próximo Seguimiento",
  observaciones: "Observaciones",
  creada: "Creada",
  estadoSeguimiento: "Estado Seguimiento",
} as const;

/** Listas desplegables: salen de la hoja "Listas" del Excel. */
export const TIPOS_VISITA = ["Presencial", "Virtual", "Llamada"] as const;

export const RESULTADOS_VISITA = [
  "Interesado",
  "Cotización enviada",
  "Venta cerrada",
  "Seguimiento pendiente",
  "Sin interés por ahora",
] as const;

export type TipoVisita = (typeof TIPOS_VISITA)[number];
export type ResultadoVisita = (typeof RESULTADOS_VISITA)[number];
export type EstadoSeguimiento = "Atrasado" | "Hoy" | "Programado" | null;

export type Visita = {
  recordId: string;
  id: string;
  idClienteCore: string | null;
  cliente: string;
  fecha: string | null;
  responsable: string | null;
  tipo: string | null;
  objetivo: string | null;
  necesidad: string | null;
  idProductosCore: string | null;
  productos: string | null;
  resultado: string | null;
  proximaAccion: string | null;
  fechaSeguimiento: string | null;
  observaciones: string | null;
  estadoSeguimiento: EstadoSeguimiento;
};

function aVisita(record: AirtableRecord): Visita {
  const f = record.fields;
  const estado = texto(f[CAMPOS_VISITA.estadoSeguimiento]);

  return {
    recordId: record.id,
    id: texto(f[CAMPOS_VISITA.id]) ?? record.id,
    idClienteCore: texto(f[CAMPOS_VISITA.idClienteCore]),
    cliente: texto(f[CAMPOS_VISITA.cliente]) ?? "Sin cliente",
    fecha: texto(f[CAMPOS_VISITA.fecha]),
    responsable: texto(f[CAMPOS_VISITA.responsable]),
    tipo: texto(f[CAMPOS_VISITA.tipo]),
    objetivo: texto(f[CAMPOS_VISITA.objetivo]),
    necesidad: texto(f[CAMPOS_VISITA.necesidad]),
    idProductosCore: texto(f[CAMPOS_VISITA.idProductosCore]),
    productos: texto(f[CAMPOS_VISITA.productos]),
    resultado: texto(f[CAMPOS_VISITA.resultado]),
    proximaAccion: texto(f[CAMPOS_VISITA.proximaAccion]),
    fechaSeguimiento: texto(f[CAMPOS_VISITA.fechaSeguimiento]),
    observaciones: texto(f[CAMPOS_VISITA.observaciones]),
    estadoSeguimiento:
      estado === "Atrasado" || estado === "Hoy" || estado === "Programado"
        ? estado
        : null,
  };
}

export async function listarVisitas(): Promise<Visita[]> {
  const registros = await listarRegistros(env.baseCrm, env.tablaVisitas, {
    sort: [{ field: CAMPOS_VISITA.fecha, direction: "desc" }],
  });
  return registros.map(aVisita);
}

export type EntradaVisita = {
  idClienteCore: string | null;
  cliente: string;
  fecha: string;
  responsable: string;
  tipo: TipoVisita;
  objetivo: string;
  necesidad?: string;
  idProductosCore?: string;
  productos?: string;
  resultado: ResultadoVisita;
  proximaAccion?: string;
  fechaSeguimiento?: string;
  observaciones?: string;
};

export async function crearVisita(entrada: EntradaVisita): Promise<Visita> {
  const fields: Record<string, unknown> = {
    [CAMPOS_VISITA.idClienteCore]: entrada.idClienteCore ?? "",
    [CAMPOS_VISITA.cliente]: entrada.cliente,
    [CAMPOS_VISITA.fecha]: entrada.fecha,
    [CAMPOS_VISITA.responsable]: entrada.responsable,
    [CAMPOS_VISITA.tipo]: entrada.tipo,
    [CAMPOS_VISITA.objetivo]: entrada.objetivo,
    [CAMPOS_VISITA.necesidad]: entrada.necesidad ?? "",
    [CAMPOS_VISITA.idProductosCore]: entrada.idProductosCore ?? "",
    [CAMPOS_VISITA.productos]: entrada.productos ?? "",
    [CAMPOS_VISITA.resultado]: entrada.resultado,
    [CAMPOS_VISITA.proximaAccion]: entrada.proximaAccion ?? "",
    [CAMPOS_VISITA.observaciones]: entrada.observaciones ?? "",
  };

  if (entrada.fechaSeguimiento) {
    fields[CAMPOS_VISITA.fechaSeguimiento] = entrada.fechaSeguimiento;
  }

  return aVisita(await crearRegistro(env.baseCrm, env.tablaVisitas, fields));
}

/** Cambia la fecha del compromiso de seguimiento de una visita. */
export async function reprogramarSeguimiento(
  recordId: string,
  fecha: string,
): Promise<Visita> {
  const record = await actualizarRegistro(
    env.baseCrm,
    env.tablaVisitas,
    recordId,
    { [CAMPOS_VISITA.fechaSeguimiento]: fecha },
  );
  return aVisita(record);
}

/**
 * Cierra el pendiente. La tabla no tiene un campo de "cumplido", así que
 * se limpia la fecha (sale del calendario) y queda la traza en Observaciones.
 */
export async function cerrarSeguimiento(
  recordId: string,
  nota: string,
  observacionesActuales: string | null,
  hoy: string,
): Promise<Visita> {
  const traza = `[${hoy}] Seguimiento cumplido: ${nota}`.trim();
  const observaciones = observacionesActuales
    ? `${observacionesActuales}\n${traza}`
    : traza;

  const record = await actualizarRegistro(
    env.baseCrm,
    env.tablaVisitas,
    recordId,
    {
      [CAMPOS_VISITA.fechaSeguimiento]: null,
      [CAMPOS_VISITA.observaciones]: observaciones,
    },
  );
  return aVisita(record);
}

/* -------------------------------- Casos --------------------------------- */

const CAMPOS_CASO = {
  id: "ID",
  cliente: "Cliente",
  tipo: "Tipo de Requerimiento",
  descripcion: "Descripción",
  responsable: "Responsable",
  estado: "Estado",
  fechaLimite: "Fecha Límite",
} as const;

export type CasoPendiente = {
  recordId: string;
  id: string;
  cliente: string;
  descripcion: string | null;
  tipo: string | null;
  responsable: string | null;
  estado: string | null;
  fechaLimite: string | null;
};

/** Casos abiertos con fecha límite: también son pendientes del calendario. */
export async function listarCasosPendientes(): Promise<CasoPendiente[]> {
  const registros = await listarRegistros(env.baseCrm, env.tablaCasos, {
    fields: Object.values(CAMPOS_CASO),
  });

  return registros
    .map((registro) => {
      const f = registro.fields;
      return {
        recordId: registro.id,
        id: texto(f[CAMPOS_CASO.id]) ?? registro.id,
        cliente: texto(f[CAMPOS_CASO.cliente]) ?? "Sin cliente",
        descripcion: texto(f[CAMPOS_CASO.descripcion]),
        tipo: texto(f[CAMPOS_CASO.tipo]),
        responsable: texto(f[CAMPOS_CASO.responsable]),
        estado: texto(f[CAMPOS_CASO.estado]),
        fechaLimite: texto(f[CAMPOS_CASO.fechaLimite]),
      };
    })
    .filter(
      (caso) =>
        caso.fechaLimite &&
        caso.estado !== "Resuelto" &&
        caso.estado !== "Cerrado",
    );
}

/* ------------------ Catálogo de productos (otra base) ------------------ */

export type ProductoCore = {
  recordId: string;
  codigo: string;
  nombre: string;
  categoria: string | null;
};

export async function listarProductos(): Promise<ProductoCore[]> {
  const registros = await listarRegistros(
    env.baseProductos,
    env.tablaProductos,
    {
      fields: [
        "Codigo Producto",
        "Nombre Comercial",
        "Categoria Producto",
        "Activo",
      ],
    },
  );

  return registros
    .map((registro) => ({
      recordId: registro.id,
      codigo: texto(registro.fields["Codigo Producto"]) ?? "",
      nombre: texto(registro.fields["Nombre Comercial"]) ?? "",
      categoria: texto(registro.fields["Categoria Producto"]),
      activo: texto(registro.fields["Activo"]),
    }))
    .filter(
      (producto) =>
        producto.nombre && producto.activo !== "No" && producto.activo !== "Inactivo",
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/* ------------------------------ Utilidades ------------------------------ */

/** Fecha de hoy en Bogotá como YYYY-MM-DD (Airtable usa fechas sin hora). */
export function hoyEnBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
