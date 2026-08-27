import {
  actualizarRegistro,
  crearRegistro,
  listarRegistros,
  texto,
} from "@/lib/airtable";
import { hoyEnBogota } from "@/lib/crm";
import { cachearLectura, ETIQUETAS } from "@/lib/cache";
import {
  alertaPorFecha,
  estaCerrado,
  type AlertaSla,
  type EstadoCaso,
  type TipoCaso,
} from "@/lib/casos-comun";
import { env } from "@/lib/env";

/**
 * Casos: los requerimientos que un cliente deja abiertos — una queja, una
 * duda técnica, una solicitud comercial — con su fecha límite de respuesta.
 * Viven en la misma base que las visitas y pueden nacer de una de ellas.
 */

const CAMPOS_CASO = {
  id: "ID",
  idClienteCore: "ID Cliente Core",
  cliente: "Cliente",
  fechaApertura: "Fecha Apertura",
  tipo: "Tipo de Requerimiento",
  descripcion: "Descripción",
  responsable: "Responsable",
  idPersonalCore: "ID Personal Core",
  modificadoPor: "Modificado Por ID",
  estado: "Estado",
  fechaLimite: "Fecha Límite",
  fechaCierre: "Fecha de Cierre",
  observaciones: "Observaciones",
  visitaOrigen: "Visita Origen",
  diasAbierto: "Días Abierto",
} as const;

export {
  ESTADOS_CASO,
  estaCerrado,
  TIPOS_CASO,
  alertaPorFecha,
} from "@/lib/casos-comun";
export type {
  AlertaSla,
  EstadoCaso,
  TipoCaso,
} from "@/lib/casos-comun";

export type Caso = {
  recordId: string;
  id: string;
  idClienteCore: string | null;
  cliente: string;
  fechaApertura: string | null;
  tipo: string | null;
  descripcion: string | null;
  responsable: string | null;
  /** ID Empleado de quien lo abrió; es la clave de propiedad. */
  idPersonalCore: string | null;
  /** ID Empleado de quien lo modificó por última vez desde el CRM. */
  modificadoPor: string | null;
  estado: string | null;
  fechaLimite: string | null;
  fechaCierre: string | null;
  observaciones: string | null;
  visitaOrigen: string[];
  diasAbierto: number | null;
  /**
   * Airtable trae un campo "Alerta SLA", pero su fórmula usa TODAY() en la
   * zona de la base. Lo recalculamos con la fecha de Bogotá para que coincida
   * con la agenda del home.
   */
  alerta: AlertaSla;
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}/;

/** Airtable puede devolver la fecha con hora; aquí solo importa el día. */
function soloDia(valor: unknown): string | null {
  const coincidencia = texto(valor)?.match(FECHA_ISO);
  return coincidencia ? coincidencia[0] : null;
}

function numero(valor: unknown): number | null {
  return typeof valor === "number" ? valor : null;
}

function idsEnlazados(valor: unknown): string[] {
  return Array.isArray(valor)
    ? valor.filter((v): v is string => typeof v === "string")
    : [];
}


function aCaso(
  registro: { id: string; fields: Record<string, unknown> },
  hoy: string,
): Caso {
  const f = registro.fields;
  const estado = texto(f[CAMPOS_CASO.estado]);
  const fechaLimite = soloDia(f[CAMPOS_CASO.fechaLimite]);

  return {
    recordId: registro.id,
    id: texto(f[CAMPOS_CASO.id]) ?? registro.id,
    idClienteCore: texto(f[CAMPOS_CASO.idClienteCore]),
    cliente: texto(f[CAMPOS_CASO.cliente]) ?? "Sin cliente",
    fechaApertura: soloDia(f[CAMPOS_CASO.fechaApertura]),
    tipo: texto(f[CAMPOS_CASO.tipo]),
    descripcion: texto(f[CAMPOS_CASO.descripcion]),
    responsable: texto(f[CAMPOS_CASO.responsable]),
    idPersonalCore: texto(f[CAMPOS_CASO.idPersonalCore]),
    modificadoPor: texto(f[CAMPOS_CASO.modificadoPor]),
    estado,
    fechaLimite,
    fechaCierre: soloDia(f[CAMPOS_CASO.fechaCierre]),
    observaciones: texto(f[CAMPOS_CASO.observaciones]),
    visitaOrigen: idsEnlazados(f[CAMPOS_CASO.visitaOrigen]),
    diasAbierto: numero(f[CAMPOS_CASO.diasAbierto]),
    alerta: alertaPorFecha(estado, fechaLimite, hoy),
  };
}

const leerCasos = cachearLectura(
  "casos",
  ETIQUETAS.casos,
  async (): Promise<Caso[]> => {
    const registros = await listarRegistros(env.baseCrm, env.tablaCasos, {
      fields: Object.values(CAMPOS_CASO),
      sort: [{ field: CAMPOS_CASO.fechaApertura, direction: "desc" }],
    });
    const hoy = hoyEnBogota();
    return registros.map((registro) => aCaso(registro, hoy));
  },
);

export async function listarCasos(): Promise<Caso[]> {
  return leerCasos();
}

/** Un caso por su recordId, para verificar de quién es antes de escribirlo. */
export async function obtenerCaso(recordId: string): Promise<Caso | null> {
  const registros = await listarRegistros(env.baseCrm, env.tablaCasos, {
    fields: Object.values(CAMPOS_CASO),
    filterByFormula: `RECORD_ID() = '${recordId}'`,
    maxRecords: 1,
  });

  return registros[0] ? aCaso(registros[0], hoyEnBogota()) : null;
}

/** Casos abiertos con fecha límite: los que el calendario del home muestra. */
export async function listarCasosPendientes(): Promise<Caso[]> {
  const casos = await listarCasos();
  return casos.filter((caso) => caso.fechaLimite && !estaCerrado(caso.estado));
}

export type EntradaCaso = {
  idClienteCore: string | null;
  cliente: string;
  fechaApertura: string;
  tipo: TipoCaso;
  descripcion: string;
  responsable: string;
  /** ID Empleado del dueño del caso. */
  idPersonalCore: string;
  /** ID Empleado de quien lo está abriendo (puede no ser el dueño). */
  autorId: string;
  estado: EstadoCaso;
  fechaLimite?: string;
  observaciones?: string;
  visitaOrigen?: string;
};

export async function crearCaso(entrada: EntradaCaso): Promise<Caso> {
  const fields: Record<string, unknown> = {
    [CAMPOS_CASO.idClienteCore]: entrada.idClienteCore ?? "",
    [CAMPOS_CASO.cliente]: entrada.cliente,
    [CAMPOS_CASO.fechaApertura]: entrada.fechaApertura,
    [CAMPOS_CASO.tipo]: entrada.tipo,
    [CAMPOS_CASO.descripcion]: entrada.descripcion,
    [CAMPOS_CASO.responsable]: entrada.responsable,
    [CAMPOS_CASO.idPersonalCore]: entrada.idPersonalCore,
    [CAMPOS_CASO.modificadoPor]: entrada.autorId,
    [CAMPOS_CASO.estado]: entrada.estado,
    [CAMPOS_CASO.observaciones]: entrada.observaciones ?? "",
  };

  // Airtable rechaza una fecha vacía: el campo se omite si no hay plazo.
  if (entrada.fechaLimite) {
    fields[CAMPOS_CASO.fechaLimite] = entrada.fechaLimite;
  }
  if (entrada.visitaOrigen) {
    fields[CAMPOS_CASO.visitaOrigen] = [entrada.visitaOrigen];
  }

  const registro = await crearRegistro(env.baseCrm, env.tablaCasos, fields);
  return aCaso(registro, hoyEnBogota());
}

/**
 * Cambia el estado del caso. Resolver o cerrar sella la fecha de cierre;
 * reabrir la borra, para que "Días Abierto" vuelva a contar desde la apertura.
 */
export async function cambiarEstadoCaso(
  recordId: string,
  estado: EstadoCaso,
  observaciones: string | null,
  autorId: string,
): Promise<Caso> {
  const fields: Record<string, unknown> = {
    [CAMPOS_CASO.estado]: estado,
    [CAMPOS_CASO.fechaCierre]: estaCerrado(estado) ? hoyEnBogota() : null,
    [CAMPOS_CASO.modificadoPor]: autorId,
  };

  if (observaciones !== null) {
    fields[CAMPOS_CASO.observaciones] = observaciones;
  }

  const registro = await actualizarRegistro(
    env.baseCrm,
    env.tablaCasos,
    recordId,
    fields,
  );
  return aCaso(registro, hoyEnBogota());
}

/** Mueve la fecha límite de respuesta sin tocar el estado. */
export async function reprogramarLimite(
  recordId: string,
  fecha: string,
  autorId: string,
): Promise<Caso> {
  const registro = await actualizarRegistro(
    env.baseCrm,
    env.tablaCasos,
    recordId,
    {
      [CAMPOS_CASO.fechaLimite]: fecha,
      [CAMPOS_CASO.modificadoPor]: autorId,
    },
  );
  return aCaso(registro, hoyEnBogota());
}
