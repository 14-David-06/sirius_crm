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
  anotarHistorial,
  describirCambio,
  describirTipo,
  TIPO_OTRO,
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
  idContactoCore: "ID Contacto Cliente",
  fechaApertura: "Fecha Apertura",
  tipo: "Tipo de Requerimiento",
  tipoOtroDetalle: "Tipo Otro Detalle",
  descripcion: "Descripción",
  responsable: "Responsable",
  idPersonalCore: "ID Personal Core",
  recibidoPor: "Recibido Por ID",
  modificadoPor: "Modificado Por ID",
  estado: "Estado",
  fechaLimite: "Fecha Límite",
  fechaCierre: "Fecha de Cierre",
  seguimiento: "Seguimiento",
  solucionFinal: "Solucion Final",
  historial: "Historial",
  observaciones: "Observaciones",
  visitaOrigen: "Visita Origen",
  diasAbierto: "Días Abierto",
} as const;

export {
  describirTipo,
  ESTADOS_CASO,
  estaCerrado,
  TIPO_OTRO,
  exigeSolucion,
  TIPOS_CASO,
  TIPOS_CASO_ANTERIORES,
  TIPOS_PQRSF,
  alertaPorFecha,
} from "@/lib/casos-comun";
export type {
  AlertaSla,
  EstadoCaso,
  TipoCaso,
  TipoPqrsf,
} from "@/lib/casos-comun";

export type Caso = {
  recordId: string;
  id: string;
  idClienteCore: string | null;
  cliente: string;
  /** Codigo Persona Cliente de quien reportó el caso; null si no se anotó. */
  idContactoCore: string | null;
  fechaApertura: string | null;
  tipo: string | null;
  /** Solo tiene contenido cuando el tipo es "Otro". */
  tipoOtroDetalle: string | null;
  descripcion: string | null;
  responsable: string | null;
  /** ID Empleado del responsable del trámite; es la clave de propiedad. */
  idPersonalCore: string | null;
  /** ID Empleado de quien lo recibió o digitó; puede no ser el responsable. */
  recibidoPor: string | null;
  /** ID Empleado de quien lo modificó por última vez desde el CRM. */
  modificadoPor: string | null;
  estado: string | null;
  fechaLimite: string | null;
  fechaCierre: string | null;
  /** Bitácora de gestión: qué se ha hecho hasta ahora. */
  seguimiento: string | null;
  /** La respuesta que se le dio al cliente. Obligatoria al cerrar. */
  solucionFinal: string | null;
  /** Traza de cambios, solo de lectura: se agrega, nunca se reescribe. */
  historial: string | null;
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
    idContactoCore: texto(f[CAMPOS_CASO.idContactoCore]),
    fechaApertura: soloDia(f[CAMPOS_CASO.fechaApertura]),
    tipo: texto(f[CAMPOS_CASO.tipo]),
    tipoOtroDetalle: texto(f[CAMPOS_CASO.tipoOtroDetalle]),
    descripcion: texto(f[CAMPOS_CASO.descripcion]),
    responsable: texto(f[CAMPOS_CASO.responsable]),
    idPersonalCore: texto(f[CAMPOS_CASO.idPersonalCore]),
    recibidoPor: texto(f[CAMPOS_CASO.recibidoPor]),
    modificadoPor: texto(f[CAMPOS_CASO.modificadoPor]),
    estado,
    fechaLimite,
    fechaCierre: soloDia(f[CAMPOS_CASO.fechaCierre]),
    seguimiento: texto(f[CAMPOS_CASO.seguimiento]),
    solucionFinal: texto(f[CAMPOS_CASO.solucionFinal]),
    historial: texto(f[CAMPOS_CASO.historial]),
    observaciones: texto(f[CAMPOS_CASO.observaciones]),
    visitaOrigen: idsEnlazados(f[CAMPOS_CASO.visitaOrigen]),
    diasAbierto: numero(f[CAMPOS_CASO.diasAbierto]),
    alerta: alertaPorFecha(estado, fechaLimite, hoy),
  };
}

const leerCasos = cachearLectura(
  // v3: `Caso` sumó el detalle del tipo "Otro".
  "casos-v3",
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
  idContactoCore?: string;
  fechaApertura: string;
  tipo: TipoCaso;
  /** Obligatorio cuando el tipo es "Otro"; se ignora en los demás. */
  tipoOtroDetalle?: string;
  descripcion: string;
  responsable: string;
  /** ID Empleado del dueño del caso. */
  idPersonalCore: string;
  /** ID Empleado de quien lo está abriendo (puede no ser el dueño). */
  autorId: string;
  estado: EstadoCaso;
  fechaLimite?: string;
  seguimiento?: string;
  observaciones?: string;
  visitaOrigen?: string;
};

export async function crearCaso(entrada: EntradaCaso): Promise<Caso> {
  const fields: Record<string, unknown> = {
    [CAMPOS_CASO.idClienteCore]: entrada.idClienteCore ?? "",
    [CAMPOS_CASO.cliente]: entrada.cliente,
    [CAMPOS_CASO.idContactoCore]: entrada.idContactoCore ?? "",
    [CAMPOS_CASO.fechaApertura]: entrada.fechaApertura,
    [CAMPOS_CASO.tipo]: entrada.tipo,
    [CAMPOS_CASO.tipoOtroDetalle]:
      entrada.tipo === TIPO_OTRO ? (entrada.tipoOtroDetalle ?? "") : "",
    [CAMPOS_CASO.descripcion]: entrada.descripcion,
    [CAMPOS_CASO.responsable]: entrada.responsable,
    [CAMPOS_CASO.idPersonalCore]: entrada.idPersonalCore,
    // Quien digita queda registrado aparte del responsable del trámite: en
    // atención al cliente casi nunca son la misma persona.
    [CAMPOS_CASO.recibidoPor]: entrada.autorId,
    [CAMPOS_CASO.modificadoPor]: entrada.autorId,
    [CAMPOS_CASO.estado]: entrada.estado,
    [CAMPOS_CASO.seguimiento]: entrada.seguimiento ?? "",
    [CAMPOS_CASO.observaciones]: entrada.observaciones ?? "",
    [CAMPOS_CASO.historial]: anotarHistorial(
      null,
      `Caso abierto como ${entrada.tipo}, responsable ${entrada.responsable}`,
      entrada.fechaApertura,
      entrada.autorId,
    ),
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
 *
 * Recibe el caso tal como está para poder anotar la bitácora sin releerlo:
 * quien llama ya lo tuvo que leer para comprobar el permiso.
 */
export async function cambiarEstadoCaso(
  actual: Caso,
  estado: EstadoCaso,
  observaciones: string | null,
  autorId: string,
  /** Obligatoria al cerrar; se conserva la existente si no viene una nueva. */
  solucionFinal?: string | null,
): Promise<Caso> {
  const hoy = hoyEnBogota();
  const cierra = estaCerrado(estado);

  const fields: Record<string, unknown> = {
    [CAMPOS_CASO.estado]: estado,
    [CAMPOS_CASO.fechaCierre]: cierra ? hoy : null,
    [CAMPOS_CASO.modificadoPor]: autorId,
    [CAMPOS_CASO.historial]: anotarHistorial(
      actual.historial,
      `Estado: ${actual.estado ?? "sin estado"} → ${estado}`,
      hoy,
      autorId,
    ),
  };

  if (observaciones !== null) {
    fields[CAMPOS_CASO.observaciones] = observaciones;
  }
  if (solucionFinal !== undefined && solucionFinal !== null) {
    fields[CAMPOS_CASO.solucionFinal] = solucionFinal;
  }

  const registro = await actualizarRegistro(
    env.baseCrm,
    env.tablaCasos,
    actual.recordId,
    fields,
  );
  return aCaso(registro, hoy);
}

/**
 * Lo que se puede corregir de un caso ya abierto.
 *
 * El cliente y el estado no están aquí: el primero porque un caso de otra
 * empresa es otro caso; el segundo porque tiene su propia acción, que sella la
 * fecha de cierre y exige la solución final.
 */
export type CambiosCaso = {
  idContactoCore: string | null;
  tipo: TipoCaso;
  /** Solo se guarda cuando el tipo es "Otro"; en los demás se limpia. */
  tipoOtroDetalle: string | null;
  descripcion: string;
  fechaLimite: string | null;
  seguimiento: string | null;
  solucionFinal: string | null;
  observaciones: string | null;
};

export async function actualizarCaso(
  actual: Caso,
  datos: CambiosCaso,
  autorId: string,
): Promise<Caso> {
  const hoy = hoyEnBogota();

  // Solo se anota lo que de verdad cambió: una bitácora que registra cada
  // apertura del formulario no sirve para rastrear nada.
  const cambios = [
    describirCambio(
      "Tipo",
      describirTipo(actual.tipo, actual.tipoOtroDetalle),
      describirTipo(datos.tipo, datos.tipoOtroDetalle),
    ),
    describirCambio("Descripción", actual.descripcion, datos.descripcion),
    describirCambio("Contacto", actual.idContactoCore, datos.idContactoCore),
    describirCambio("Fecha límite", actual.fechaLimite, datos.fechaLimite),
    describirCambio("Seguimiento", actual.seguimiento, datos.seguimiento),
    describirCambio("Solución", actual.solucionFinal, datos.solucionFinal),
    describirCambio("Observaciones", actual.observaciones, datos.observaciones),
  ].filter((cambio): cambio is string => cambio !== null);

  const fields: Record<string, unknown> = {
    [CAMPOS_CASO.idContactoCore]: datos.idContactoCore ?? "",
    [CAMPOS_CASO.tipo]: datos.tipo,
    // Con cualquier otro tipo el detalle se descarta, para que no quede un
    // texto viejo contradiciendo la opción elegida.
    [CAMPOS_CASO.tipoOtroDetalle]:
      datos.tipo === TIPO_OTRO ? (datos.tipoOtroDetalle ?? "") : "",
    [CAMPOS_CASO.descripcion]: datos.descripcion,
    // Una fecha se vacía con null: "" no es una fecha y Airtable la rechaza.
    [CAMPOS_CASO.fechaLimite]: datos.fechaLimite,
    [CAMPOS_CASO.seguimiento]: datos.seguimiento ?? "",
    [CAMPOS_CASO.solucionFinal]: datos.solucionFinal ?? "",
    [CAMPOS_CASO.observaciones]: datos.observaciones ?? "",
    [CAMPOS_CASO.modificadoPor]: autorId,
  };

  if (cambios.length > 0) {
    fields[CAMPOS_CASO.historial] = anotarHistorial(
      actual.historial,
      cambios.join(" · "),
      hoy,
      autorId,
    );
  }

  const registro = await actualizarRegistro(
    env.baseCrm,
    env.tablaCasos,
    actual.recordId,
    fields,
  );
  return aCaso(registro, hoy);
}

/** Mueve la fecha límite de respuesta sin tocar el estado. */
export async function reprogramarLimite(
  actual: Caso,
  fecha: string,
  autorId: string,
): Promise<Caso> {
  const hoy = hoyEnBogota();

  const registro = await actualizarRegistro(
    env.baseCrm,
    env.tablaCasos,
    actual.recordId,
    {
      [CAMPOS_CASO.fechaLimite]: fecha,
      [CAMPOS_CASO.modificadoPor]: autorId,
      [CAMPOS_CASO.historial]: anotarHistorial(
        actual.historial,
        `Fecha límite: ${actual.fechaLimite ?? "sin plazo"} → ${fecha}`,
        hoy,
        autorId,
      ),
    },
  );
  return aCaso(registro, hoy);
}
