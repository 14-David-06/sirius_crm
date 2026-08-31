import {
  actualizarRegistro,
  crearRegistro,
  listarRegistros,
  texto,
  type AirtableRecord,
} from "@/lib/airtable";
import { cachearLectura, ETIQUETAS } from "@/lib/cache";
import type {
  EstadoSeguimiento,
  ResultadoVisita,
  TipoVisita,
} from "@/lib/crm-comun";
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
  idContactoCore: "ID Contacto Cliente",
  fecha: "Fecha Visita",
  responsable: "Responsable Comercial",
  idPersonalCore: "ID Personal Core",
  modificadoPor: "Modificado Por ID",
  tipo: "Tipo de Visita",
  objetivo: "Objetivo de la Visita",
  necesidad: "Necesidad o Diagnóstico",
  idProductosCore: "ID Productos Core",
  productos: "Productos de Interés",
  resultado: "Resultado",
  proximaAccion: "Próxima Acción",
  fechaSeguimiento: "Fecha Próximo Seguimiento",
  pendientes: "Pendientes",
  observaciones: "Observaciones",
  creada: "Creada",
  estadoSeguimiento: "Estado Seguimiento",
} as const;

/** Listas desplegables: salen de la hoja "Listas" del Excel. */
export {
  esErrorVisita,
  RESULTADOS_VISITA,
  revisarVisita,
  TIPOS_VISITA,
} from "@/lib/crm-comun";
export type {
  EstadoSeguimiento,
  ResultadoVisita,
  TipoVisita,
} from "@/lib/crm-comun";

export type Visita = {
  recordId: string;
  id: string;
  idClienteCore: string | null;
  cliente: string;
  /** Codigo Persona Cliente del contacto con quien se hizo; null si no se anotó. */
  idContactoCore: string | null;
  fecha: string | null;
  responsable: string | null;
  /** ID Empleado de quien la registró; es la clave de propiedad. */
  idPersonalCore: string | null;
  /** ID Empleado de quien la modificó por última vez desde el CRM. */
  modificadoPor: string | null;
  tipo: string | null;
  objetivo: string | null;
  necesidad: string | null;
  idProductosCore: string | null;
  productos: string | null;
  resultado: string | null;
  proximaAccion: string | null;
  fechaSeguimiento: string | null;
  /** Lo que queda abierto, aparte de la próxima acción con fecha. */
  pendientes: string | null;
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
    idContactoCore: texto(f[CAMPOS_VISITA.idContactoCore]),
    fecha: texto(f[CAMPOS_VISITA.fecha]),
    responsable: texto(f[CAMPOS_VISITA.responsable]),
    idPersonalCore: texto(f[CAMPOS_VISITA.idPersonalCore]),
    modificadoPor: texto(f[CAMPOS_VISITA.modificadoPor]),
    tipo: texto(f[CAMPOS_VISITA.tipo]),
    objetivo: texto(f[CAMPOS_VISITA.objetivo]),
    necesidad: texto(f[CAMPOS_VISITA.necesidad]),
    idProductosCore: texto(f[CAMPOS_VISITA.idProductosCore]),
    productos: texto(f[CAMPOS_VISITA.productos]),
    resultado: texto(f[CAMPOS_VISITA.resultado]),
    proximaAccion: texto(f[CAMPOS_VISITA.proximaAccion]),
    fechaSeguimiento: texto(f[CAMPOS_VISITA.fechaSeguimiento]),
    pendientes: texto(f[CAMPOS_VISITA.pendientes]),
    observaciones: texto(f[CAMPOS_VISITA.observaciones]),
    estadoSeguimiento:
      estado === "Atrasado" || estado === "Hoy" || estado === "Programado"
        ? estado
        : null,
  };
}

const leerVisitas = cachearLectura(
  // v2: `Visita` sumó contacto y pendientes.
  "visitas-v2",
  ETIQUETAS.visitas,
  async (): Promise<Visita[]> => {
    const registros = await listarRegistros(env.baseCrm, env.tablaVisitas, {
      sort: [{ field: CAMPOS_VISITA.fecha, direction: "desc" }],
    });
    return registros.map(aVisita);
  },
);

export async function listarVisitas(): Promise<Visita[]> {
  return leerVisitas();
}

/** Una visita por su recordId, para verificar de quién es antes de escribirla. */
export async function obtenerVisita(recordId: string): Promise<Visita | null> {
  const registros = await listarRegistros(env.baseCrm, env.tablaVisitas, {
    filterByFormula: `RECORD_ID() = '${recordId}'`,
    maxRecords: 1,
  });

  return registros[0] ? aVisita(registros[0]) : null;
}

export type EntradaVisita = {
  idClienteCore: string | null;
  cliente: string;
  idContactoCore?: string;
  fecha: string;
  responsable: string;
  /** ID Empleado del dueño de la visita. */
  idPersonalCore: string;
  /** ID Empleado de quien la está registrando (puede no ser el dueño). */
  autorId: string;
  tipo: TipoVisita;
  objetivo: string;
  necesidad?: string;
  idProductosCore?: string;
  productos?: string;
  resultado: ResultadoVisita;
  proximaAccion?: string;
  fechaSeguimiento?: string;
  pendientes?: string;
  observaciones?: string;
};

export async function crearVisita(entrada: EntradaVisita): Promise<Visita> {
  const fields: Record<string, unknown> = {
    [CAMPOS_VISITA.idClienteCore]: entrada.idClienteCore ?? "",
    [CAMPOS_VISITA.cliente]: entrada.cliente,
    [CAMPOS_VISITA.idContactoCore]: entrada.idContactoCore ?? "",
    [CAMPOS_VISITA.fecha]: entrada.fecha,
    [CAMPOS_VISITA.responsable]: entrada.responsable,
    [CAMPOS_VISITA.idPersonalCore]: entrada.idPersonalCore,
    [CAMPOS_VISITA.modificadoPor]: entrada.autorId,
    [CAMPOS_VISITA.tipo]: entrada.tipo,
    [CAMPOS_VISITA.objetivo]: entrada.objetivo,
    [CAMPOS_VISITA.necesidad]: entrada.necesidad ?? "",
    [CAMPOS_VISITA.idProductosCore]: entrada.idProductosCore ?? "",
    [CAMPOS_VISITA.productos]: entrada.productos ?? "",
    [CAMPOS_VISITA.resultado]: entrada.resultado,
    [CAMPOS_VISITA.proximaAccion]: entrada.proximaAccion ?? "",
    [CAMPOS_VISITA.pendientes]: entrada.pendientes ?? "",
    [CAMPOS_VISITA.observaciones]: entrada.observaciones ?? "",
  };

  if (entrada.fechaSeguimiento) {
    fields[CAMPOS_VISITA.fechaSeguimiento] = entrada.fechaSeguimiento;
  }

  return aVisita(await crearRegistro(env.baseCrm, env.tablaVisitas, fields));
}

/**
 * Lo que se puede corregir de una visita ya registrada.
 *
 * El responsable no está aquí: es la clave de propiedad con la que se decide
 * quién puede editarla, y cambiarlo desde la misma pantalla que exige el
 * permiso sería una puerta trasera. El cliente tampoco: una visita hecha a
 * otra empresa no es una corrección, es otra visita.
 */
export type CambiosVisita = {
  idContactoCore: string | null;
  fecha: string;
  tipo: TipoVisita;
  objetivo: string;
  necesidad: string | null;
  idProductosCore: string | null;
  productos: string | null;
  resultado: ResultadoVisita;
  proximaAccion: string | null;
  fechaSeguimiento: string | null;
  pendientes: string | null;
  observaciones: string | null;
};

export async function actualizarVisita(
  recordId: string,
  datos: CambiosVisita,
  autorId: string,
): Promise<Visita> {
  const record = await actualizarRegistro(
    env.baseCrm,
    env.tablaVisitas,
    recordId,
    {
      [CAMPOS_VISITA.idContactoCore]: datos.idContactoCore ?? "",
      [CAMPOS_VISITA.fecha]: datos.fecha,
      [CAMPOS_VISITA.tipo]: datos.tipo,
      [CAMPOS_VISITA.objetivo]: datos.objetivo,
      [CAMPOS_VISITA.necesidad]: datos.necesidad ?? "",
      [CAMPOS_VISITA.idProductosCore]: datos.idProductosCore ?? "",
      [CAMPOS_VISITA.productos]: datos.productos ?? "",
      [CAMPOS_VISITA.resultado]: datos.resultado,
      [CAMPOS_VISITA.proximaAccion]: datos.proximaAccion ?? "",
      // Una fecha se vacía con null: "" no es una fecha y Airtable la rechaza.
      [CAMPOS_VISITA.fechaSeguimiento]: datos.fechaSeguimiento,
      [CAMPOS_VISITA.pendientes]: datos.pendientes ?? "",
      [CAMPOS_VISITA.observaciones]: datos.observaciones ?? "",
      [CAMPOS_VISITA.modificadoPor]: autorId,
    },
  );
  return aVisita(record);
}

/** Cambia la fecha del compromiso de seguimiento de una visita. */
export async function reprogramarSeguimiento(
  recordId: string,
  fecha: string,
  autorId: string,
): Promise<Visita> {
  const record = await actualizarRegistro(
    env.baseCrm,
    env.tablaVisitas,
    recordId,
    {
      [CAMPOS_VISITA.fechaSeguimiento]: fecha,
      [CAMPOS_VISITA.modificadoPor]: autorId,
    },
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
  autorId: string,
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
      [CAMPOS_VISITA.modificadoPor]: autorId,
    },
  );
  return aVisita(record);
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
