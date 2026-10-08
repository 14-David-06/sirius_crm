import {
  actualizarRegistro,
  crearRegistro,
  listarPersonalActivo,
  listarRegistros,
  texto,
  type AirtableRecord,
} from "@/lib/airtable";
import { cachearLectura, ETIQUETAS } from "@/lib/cache";
import { anotarHistorial, describirCambio } from "@/lib/casos-comun";
import { hoyEnBogota } from "@/lib/crm";
import { env } from "@/lib/env";
import {
  codigoDesdeSerial,
  proyectoCerrado,
  type EstadoProyecto,
  type EstadoTarea,
  type Veredicto,
} from "@/lib/proyectos-comun";

/**
 * Proyectos: pruebas de campo de productos Sirius con un cliente. Cada uno
 * tiene objetivo, metodología, un cronograma de tareas con encargado y, al
 * final, los resultados que justifican haberlo hecho. Viven en la base Sirius
 * CRM junto a visitas y casos; el cliente se referencia por su serial.
 */

const CAMPOS_PROYECTO = {
  id: "ID",
  serial: "Codigo Serial",
  nombre: "Nombre",
  idClienteCore: "ID Cliente Core",
  cliente: "Cliente",
  cultivo: "Cultivo",
  ubicacion: "Ubicación",
  idProductosCore: "ID Productos Core",
  productos: "Productos",
  objetivo: "Objetivo",
  metodologia: "Metodología",
  indicadores: "Indicadores",
  estado: "Estado",
  fechaInicio: "Fecha Inicio",
  fechaFinPlaneada: "Fecha Fin Planeada",
  fechaCierre: "Fecha Cierre",
  lider: "Líder",
  idPersonalCore: "ID Personal Core",
  creadoPor: "Creado Por ID",
  modificadoPor: "Modificado Por ID",
  bitacora: "Bitácora",
  resultados: "Resultados",
  veredicto: "Veredicto",
  conclusion: "Conclusión",
  historial: "Historial",
  observaciones: "Observaciones",
} as const;

const CAMPOS_TAREA = {
  id: "ID",
  serial: "Codigo Serial",
  proyecto: "Proyecto",
  tarea: "Tarea",
  descripcion: "Descripción",
  encargado: "Encargado",
  idPersonalCore: "ID Personal Core",
  fechaInicio: "Fecha Inicio",
  fechaFin: "Fecha Fin",
  estado: "Estado",
  fechaCompletada: "Fecha Completada",
  notas: "Notas",
  creadoPor: "Creado Por ID",
  modificadoPor: "Modificado Por ID",
} as const;

export type Proyecto = {
  recordId: string;
  id: string;
  nombre: string;
  idClienteCore: string | null;
  cliente: string;
  cultivo: string | null;
  ubicacion: string | null;
  /** Seriales de Product Core separados por coma. */
  idProductosCore: string | null;
  productos: string | null;
  objetivo: string | null;
  metodologia: string | null;
  indicadores: string | null;
  estado: string | null;
  fechaInicio: string | null;
  fechaFinPlaneada: string | null;
  fechaCierre: string | null;
  /** Nombre del líder; la propiedad la decide `idPersonalCore`. */
  responsable: string | null;
  idPersonalCore: string | null;
  creadoPor: string | null;
  modificadoPor: string | null;
  /** Avances de la ejecución. Solo se agrega. */
  bitacora: string | null;
  resultados: string | null;
  veredicto: string | null;
  conclusion: string | null;
  historial: string | null;
  observaciones: string | null;
};

export type TareaProyecto = {
  recordId: string;
  id: string;
  /** recordId del proyecto al que pertenece. */
  proyecto: string | null;
  tarea: string;
  descripcion: string | null;
  /** Nombre del encargado; la propiedad la decide `idPersonalCore`. */
  responsable: string | null;
  idPersonalCore: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: string | null;
  fechaCompletada: string | null;
  notas: string | null;
  creadoPor: string | null;
  modificadoPor: string | null;
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}/;

function soloDia(valor: unknown): string | null {
  const coincidencia = texto(valor)?.match(FECHA_ISO);
  return coincidencia ? coincidencia[0] : null;
}

function numero(valor: unknown): number | null {
  return typeof valor === "number" ? valor : null;
}

function aProyecto(registro: AirtableRecord): Proyecto {
  const f = registro.fields;
  return {
    recordId: registro.id,
    id:
      texto(f[CAMPOS_PROYECTO.id]) ??
      codigoDesdeSerial("PRY", numero(f[CAMPOS_PROYECTO.serial])) ??
      registro.id,
    nombre: texto(f[CAMPOS_PROYECTO.nombre]) ?? "Sin nombre",
    idClienteCore: texto(f[CAMPOS_PROYECTO.idClienteCore]),
    cliente: texto(f[CAMPOS_PROYECTO.cliente]) ?? "Sin cliente",
    cultivo: texto(f[CAMPOS_PROYECTO.cultivo]),
    ubicacion: texto(f[CAMPOS_PROYECTO.ubicacion]),
    idProductosCore: texto(f[CAMPOS_PROYECTO.idProductosCore]),
    productos: texto(f[CAMPOS_PROYECTO.productos]),
    objetivo: texto(f[CAMPOS_PROYECTO.objetivo]),
    metodologia: texto(f[CAMPOS_PROYECTO.metodologia]),
    indicadores: texto(f[CAMPOS_PROYECTO.indicadores]),
    estado: texto(f[CAMPOS_PROYECTO.estado]),
    fechaInicio: soloDia(f[CAMPOS_PROYECTO.fechaInicio]),
    fechaFinPlaneada: soloDia(f[CAMPOS_PROYECTO.fechaFinPlaneada]),
    fechaCierre: soloDia(f[CAMPOS_PROYECTO.fechaCierre]),
    responsable: texto(f[CAMPOS_PROYECTO.lider]),
    idPersonalCore: texto(f[CAMPOS_PROYECTO.idPersonalCore]),
    creadoPor: texto(f[CAMPOS_PROYECTO.creadoPor]),
    modificadoPor: texto(f[CAMPOS_PROYECTO.modificadoPor]),
    bitacora: texto(f[CAMPOS_PROYECTO.bitacora]),
    resultados: texto(f[CAMPOS_PROYECTO.resultados]),
    veredicto: texto(f[CAMPOS_PROYECTO.veredicto]),
    conclusion: texto(f[CAMPOS_PROYECTO.conclusion]),
    historial: texto(f[CAMPOS_PROYECTO.historial]),
    observaciones: texto(f[CAMPOS_PROYECTO.observaciones]),
  };
}

function aTarea(registro: AirtableRecord): TareaProyecto {
  const f = registro.fields;
  return {
    recordId: registro.id,
    id:
      texto(f[CAMPOS_TAREA.id]) ??
      codigoDesdeSerial("TAR", numero(f[CAMPOS_TAREA.serial])) ??
      registro.id,
    // `texto` toma el primer vínculo: una tarea pertenece a un solo proyecto.
    proyecto: texto(f[CAMPOS_TAREA.proyecto]),
    tarea: texto(f[CAMPOS_TAREA.tarea]) ?? "Sin título",
    descripcion: texto(f[CAMPOS_TAREA.descripcion]),
    responsable: texto(f[CAMPOS_TAREA.encargado]),
    idPersonalCore: texto(f[CAMPOS_TAREA.idPersonalCore]),
    fechaInicio: soloDia(f[CAMPOS_TAREA.fechaInicio]),
    fechaFin: soloDia(f[CAMPOS_TAREA.fechaFin]),
    estado: texto(f[CAMPOS_TAREA.estado]),
    fechaCompletada: soloDia(f[CAMPOS_TAREA.fechaCompletada]),
    notas: texto(f[CAMPOS_TAREA.notas]),
    creadoPor: texto(f[CAMPOS_TAREA.creadoPor]),
    modificadoPor: texto(f[CAMPOS_TAREA.modificadoPor]),
  };
}

/* -------------------------------- Lectura -------------------------------- */

const leerProyectos = cachearLectura(
  "proyectos",
  ETIQUETAS.proyectos,
  async (): Promise<Proyecto[]> => {
    const registros = await listarRegistros(env.baseCrm, env.tablaProyectos, {
      fields: Object.values(CAMPOS_PROYECTO),
      sort: [{ field: CAMPOS_PROYECTO.serial, direction: "desc" }],
    });
    return registros.map(aProyecto);
  },
);

const leerTareas = cachearLectura(
  "tareas-proyecto",
  ETIQUETAS.proyectos,
  async (): Promise<TareaProyecto[]> => {
    const registros = await listarRegistros(
      env.baseCrm,
      env.tablaTareasProyecto,
      { fields: Object.values(CAMPOS_TAREA) },
    );
    return registros.map(aTarea).sort(ordenTareas);
  },
);

/** Por fecha de inicio y luego de fin; lo que no tiene fecha va al final. */
function ordenTareas(a: TareaProyecto, b: TareaProyecto): number {
  return (
    (a.fechaInicio ?? "9999").localeCompare(b.fechaInicio ?? "9999") ||
    (a.fechaFin ?? "9999").localeCompare(b.fechaFin ?? "9999") ||
    a.id.localeCompare(b.id)
  );
}

export async function listarProyectos(): Promise<Proyecto[]> {
  return leerProyectos();
}

export async function listarTareasProyecto(): Promise<TareaProyecto[]> {
  return leerTareas();
}

/** Un proyecto por su recordId, sin caché: decide permisos antes de escribir. */
export async function obtenerProyecto(
  recordId: string,
): Promise<Proyecto | null> {
  const registros = await listarRegistros(env.baseCrm, env.tablaProyectos, {
    fields: Object.values(CAMPOS_PROYECTO),
    filterByFormula: `RECORD_ID() = '${recordId}'`,
    maxRecords: 1,
  });
  return registros[0] ? aProyecto(registros[0]) : null;
}

/**
 * Las tareas de un proyecto, sin caché: deciden si quien escribe participa.
 *
 * El filtro va por recordId en JS y no con fórmula: en `filterByFormula` un
 * campo de vínculo se ve como el texto del primario del proyecto, no como su
 * recordId, y ese primario puede estar vacío mientras no sea fórmula.
 */
export async function listarTareasDe(
  proyectoId: string,
): Promise<TareaProyecto[]> {
  const registros = await listarRegistros(
    env.baseCrm,
    env.tablaTareasProyecto,
    { fields: Object.values(CAMPOS_TAREA) },
  );
  return registros
    .map(aTarea)
    .filter((tarea) => tarea.proyecto === proyectoId)
    .sort(ordenTareas);
}

/* ------------------------------- Proyectos ------------------------------- */

/** Lo que se diligencia del proyecto, al crearlo y al corregirlo. */
export type DatosProyecto = {
  nombre: string;
  cultivo: string | null;
  ubicacion: string | null;
  idProductosCore: string | null;
  productos: string | null;
  objetivo: string;
  metodologia: string | null;
  indicadores: string | null;
  fechaInicio: string | null;
  fechaFinPlaneada: string | null;
  observaciones: string | null;
};

export type EntradaProyecto = DatosProyecto & {
  idClienteCore: string | null;
  cliente: string;
  estado: EstadoProyecto;
  responsable: string;
  idPersonalCore: string;
  autorId: string;
};

function camposDatos(datos: DatosProyecto): Record<string, unknown> {
  return {
    [CAMPOS_PROYECTO.nombre]: datos.nombre,
    [CAMPOS_PROYECTO.cultivo]: datos.cultivo ?? "",
    [CAMPOS_PROYECTO.ubicacion]: datos.ubicacion ?? "",
    [CAMPOS_PROYECTO.idProductosCore]: datos.idProductosCore ?? "",
    [CAMPOS_PROYECTO.productos]: datos.productos ?? "",
    [CAMPOS_PROYECTO.objetivo]: datos.objetivo,
    [CAMPOS_PROYECTO.metodologia]: datos.metodologia ?? "",
    [CAMPOS_PROYECTO.indicadores]: datos.indicadores ?? "",
    // Una fecha se vacía con null: "" no es una fecha y Airtable la rechaza.
    [CAMPOS_PROYECTO.fechaInicio]: datos.fechaInicio,
    [CAMPOS_PROYECTO.fechaFinPlaneada]: datos.fechaFinPlaneada,
    [CAMPOS_PROYECTO.observaciones]: datos.observaciones ?? "",
  };
}

export async function crearProyecto(
  entrada: EntradaProyecto,
): Promise<Proyecto> {
  const hoy = hoyEnBogota();
  const registro = await crearRegistro(env.baseCrm, env.tablaProyectos, {
    ...camposDatos(entrada),
    [CAMPOS_PROYECTO.idClienteCore]: entrada.idClienteCore ?? "",
    [CAMPOS_PROYECTO.cliente]: entrada.cliente,
    [CAMPOS_PROYECTO.estado]: entrada.estado,
    [CAMPOS_PROYECTO.lider]: entrada.responsable,
    [CAMPOS_PROYECTO.idPersonalCore]: entrada.idPersonalCore,
    [CAMPOS_PROYECTO.creadoPor]: entrada.autorId,
    [CAMPOS_PROYECTO.modificadoPor]: entrada.autorId,
    [CAMPOS_PROYECTO.historial]: anotarHistorial(
      null,
      `Proyecto creado en ${entrada.estado}, líder ${entrada.responsable}`,
      hoy,
      entrada.autorId,
    ),
  });
  return aProyecto(registro);
}

export async function actualizarProyecto(
  actual: Proyecto,
  datos: DatosProyecto & { lider?: { responsable: string; idPersonalCore: string } },
  autorId: string,
): Promise<Proyecto> {
  const hoy = hoyEnBogota();

  // Solo se anota lo que de verdad cambió.
  const cambios = [
    describirCambio("Nombre", actual.nombre, datos.nombre),
    describirCambio("Cultivo", actual.cultivo, datos.cultivo),
    describirCambio("Ubicación", actual.ubicacion, datos.ubicacion),
    describirCambio("Productos", actual.productos, datos.productos),
    describirCambio("Objetivo", actual.objetivo, datos.objetivo),
    describirCambio("Metodología", actual.metodologia, datos.metodologia),
    describirCambio("Indicadores", actual.indicadores, datos.indicadores),
    describirCambio("Inicio", actual.fechaInicio, datos.fechaInicio),
    describirCambio("Fin planeado", actual.fechaFinPlaneada, datos.fechaFinPlaneada),
    describirCambio("Observaciones", actual.observaciones, datos.observaciones),
    datos.lider
      ? describirCambio("Líder", actual.responsable, datos.lider.responsable)
      : null,
  ].filter((cambio): cambio is string => cambio !== null);

  const fields: Record<string, unknown> = {
    ...camposDatos(datos),
    [CAMPOS_PROYECTO.modificadoPor]: autorId,
  };
  if (datos.lider) {
    fields[CAMPOS_PROYECTO.lider] = datos.lider.responsable;
    fields[CAMPOS_PROYECTO.idPersonalCore] = datos.lider.idPersonalCore;
  }
  if (cambios.length > 0) {
    fields[CAMPOS_PROYECTO.historial] = anotarHistorial(
      actual.historial,
      cambios.join(" · "),
      hoy,
      autorId,
    );
  }

  const registro = await actualizarRegistro(
    env.baseCrm,
    env.tablaProyectos,
    actual.recordId,
    fields,
  );
  return aProyecto(registro);
}

export type CierreProyecto = {
  resultados: string | null;
  veredicto: Veredicto | null;
  conclusion: string | null;
};

/**
 * Cambia el estado. Finalizar o cancelar sella la fecha de cierre; reabrir la
 * borra. Los resultados se guardan en el mismo paso porque es al finalizar
 * cuando se escriben.
 */
export async function cambiarEstadoProyecto(
  actual: Proyecto,
  estado: EstadoProyecto,
  cierre: CierreProyecto,
  autorId: string,
): Promise<Proyecto> {
  const hoy = hoyEnBogota();
  const cierra = proyectoCerrado(estado);

  const fields: Record<string, unknown> = {
    [CAMPOS_PROYECTO.estado]: estado,
    [CAMPOS_PROYECTO.fechaCierre]: cierra ? hoy : null,
    [CAMPOS_PROYECTO.modificadoPor]: autorId,
    [CAMPOS_PROYECTO.historial]: anotarHistorial(
      actual.historial,
      `Estado: ${actual.estado ?? "sin estado"} → ${estado}`,
      hoy,
      autorId,
    ),
  };
  // Se guarda lo que venga; lo que no venga se conserva.
  if (cierre.resultados !== null) {
    fields[CAMPOS_PROYECTO.resultados] = cierre.resultados;
  }
  if (cierre.veredicto !== null) {
    fields[CAMPOS_PROYECTO.veredicto] = cierre.veredicto;
  }
  if (cierre.conclusion !== null) {
    fields[CAMPOS_PROYECTO.conclusion] = cierre.conclusion;
  }

  const registro = await actualizarRegistro(
    env.baseCrm,
    env.tablaProyectos,
    actual.recordId,
    fields,
  );
  return aProyecto(registro);
}

/** Corrige los resultados sin mover el estado. */
export async function actualizarResultados(
  actual: Proyecto,
  cierre: { resultados: string | null; veredicto: Veredicto | null; conclusion: string | null },
  autorId: string,
): Promise<Proyecto> {
  const hoy = hoyEnBogota();
  const cambios = [
    describirCambio("Resultados", actual.resultados, cierre.resultados),
    describirCambio("Veredicto", actual.veredicto, cierre.veredicto),
    describirCambio("Conclusión", actual.conclusion, cierre.conclusion),
  ].filter((cambio): cambio is string => cambio !== null);

  const fields: Record<string, unknown> = {
    [CAMPOS_PROYECTO.resultados]: cierre.resultados ?? "",
    // Un select se vacía con null.
    [CAMPOS_PROYECTO.veredicto]: cierre.veredicto,
    [CAMPOS_PROYECTO.conclusion]: cierre.conclusion ?? "",
    [CAMPOS_PROYECTO.modificadoPor]: autorId,
  };
  if (cambios.length > 0) {
    fields[CAMPOS_PROYECTO.historial] = anotarHistorial(
      actual.historial,
      cambios.join(" · "),
      hoy,
      autorId,
    );
  }

  const registro = await actualizarRegistro(
    env.baseCrm,
    env.tablaProyectos,
    actual.recordId,
    fields,
  );
  return aProyecto(registro);
}

/** Agrega un avance a la bitácora de ejecución. */
export async function anotarBitacora(
  actual: Proyecto,
  nota: string,
  autor: { idEmpleado: string; nombre: string },
): Promise<Proyecto> {
  const hoy = hoyEnBogota();
  // Se firma con el nombre y no con el ID: la bitácora la lee el equipo, y el
  // historial ya guarda el ID de quien escribió.
  const bitacora = anotarHistorial(
    actual.bitacora,
    nota.replace(/\s*\n\s*/g, " "),
    hoy,
    autor.nombre,
  );

  const registro = await actualizarRegistro(
    env.baseCrm,
    env.tablaProyectos,
    actual.recordId,
    {
      [CAMPOS_PROYECTO.bitacora]: bitacora,
      [CAMPOS_PROYECTO.modificadoPor]: autor.idEmpleado,
    },
  );
  return aProyecto(registro);
}

/* -------------------------------- Tareas -------------------------------- */

export type DatosTarea = {
  tarea: string;
  descripcion: string | null;
  responsable: string;
  idPersonalCore: string;
  fechaInicio: string | null;
  fechaFin: string | null;
};

export async function crearTarea(
  proyectoId: string,
  datos: DatosTarea & { estado: EstadoTarea },
  autorId: string,
): Promise<TareaProyecto> {
  const fields: Record<string, unknown> = {
    [CAMPOS_TAREA.proyecto]: [proyectoId],
    [CAMPOS_TAREA.tarea]: datos.tarea,
    [CAMPOS_TAREA.descripcion]: datos.descripcion ?? "",
    [CAMPOS_TAREA.encargado]: datos.responsable,
    [CAMPOS_TAREA.idPersonalCore]: datos.idPersonalCore,
    [CAMPOS_TAREA.estado]: datos.estado,
    [CAMPOS_TAREA.creadoPor]: autorId,
    [CAMPOS_TAREA.modificadoPor]: autorId,
  };
  if (datos.fechaInicio) fields[CAMPOS_TAREA.fechaInicio] = datos.fechaInicio;
  if (datos.fechaFin) fields[CAMPOS_TAREA.fechaFin] = datos.fechaFin;

  const registro = await crearRegistro(
    env.baseCrm,
    env.tablaTareasProyecto,
    fields,
  );
  return aTarea(registro);
}

export async function actualizarTarea(
  actual: TareaProyecto,
  datos: DatosTarea,
  autorId: string,
): Promise<TareaProyecto> {
  const registro = await actualizarRegistro(
    env.baseCrm,
    env.tablaTareasProyecto,
    actual.recordId,
    {
      [CAMPOS_TAREA.tarea]: datos.tarea,
      [CAMPOS_TAREA.descripcion]: datos.descripcion ?? "",
      [CAMPOS_TAREA.encargado]: datos.responsable,
      [CAMPOS_TAREA.idPersonalCore]: datos.idPersonalCore,
      [CAMPOS_TAREA.fechaInicio]: datos.fechaInicio,
      [CAMPOS_TAREA.fechaFin]: datos.fechaFin,
      [CAMPOS_TAREA.modificadoPor]: autorId,
    },
  );
  return aTarea(registro);
}

/**
 * Mueve el estado de la tarea y guarda sus notas. Completarla sella la fecha;
 * cualquier otro estado la borra, para que no quede una fecha de una tarea que
 * se reabrió.
 */
export async function avanzarTarea(
  actual: TareaProyecto,
  estado: EstadoTarea,
  notas: string | null,
  autorId: string,
): Promise<TareaProyecto> {
  const hoy = hoyEnBogota();
  const fields: Record<string, unknown> = {
    [CAMPOS_TAREA.estado]: estado,
    [CAMPOS_TAREA.fechaCompletada]:
      estado === "Completada"
        ? actual.estado === "Completada"
          ? actual.fechaCompletada
          : hoy
        : null,
    [CAMPOS_TAREA.modificadoPor]: autorId,
  };
  if (notas !== null) fields[CAMPOS_TAREA.notas] = notas;

  const registro = await actualizarRegistro(
    env.baseCrm,
    env.tablaTareasProyecto,
    actual.recordId,
    fields,
  );
  return aTarea(registro);
}

/**
 * El encargado de una tarea, resuelto contra el personal activo. El líder
 * asigna a cualquiera del equipo, así que no pasa por `resolverAutoria`, que
 * limita a quien no es mando a su propio nombre; pero el ID igual se valida
 * aquí y nunca se toma tal cual del cliente.
 */
export async function resolverEncargado(
  idEmpleado: string | null,
): Promise<{ responsable: string; idPersonalCore: string } | null> {
  if (!idEmpleado) return null;
  const personal = await listarPersonalActivo();
  const persona = personal.find((p) => p.idEmpleado === idEmpleado);
  return persona
    ? { responsable: persona.nombre, idPersonalCore: persona.idEmpleado }
    : null;
}
