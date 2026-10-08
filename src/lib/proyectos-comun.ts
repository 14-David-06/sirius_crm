/**
 * Lo que de Proyectos comparten el cliente y el servidor: las opciones de los
 * selects, el avance, el cronograma y quién puede qué. Vive aparte de
 * `proyectos.ts` para que un componente `"use client"` no arrastre la capa de
 * Airtable al bundle del navegador.
 *
 * Un proyecto es una prueba de campo de productos Sirius con un cliente. Su
 * avance sale de las tareas del cronograma, cada una con su encargado.
 */

import { esDeLaSesion, type Autor, type Permisos } from "@/lib/permisos";

export const ESTADOS_PROYECTO = [
  "Planeación",
  "En ejecución",
  "En evaluación",
  "Finalizado",
  "Cancelado",
] as const;

export const VEREDICTOS = [
  "Exitosa",
  "Parcial",
  "No exitosa",
  "No concluyente",
] as const;

export const ESTADOS_TAREA = [
  "Pendiente",
  "En curso",
  "Completada",
  "Cancelada",
] as const;

export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];
export type Veredicto = (typeof VEREDICTOS)[number];
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

/** Un proyecto deja de exigir trabajo cuando se finaliza o se cancela. */
export function proyectoCerrado(estado: string | null): boolean {
  return estado === "Finalizado" || estado === "Cancelado";
}

/**
 * Finalizar una prueba sin anotar qué se midió y qué se concluyó la deja
 * inservible: el punto de hacerla era tener ese resultado. Cancelar no lo
 * exige, porque una prueba cancelada puede no haber llegado a medir nada.
 */
export function exigeResultados(estado: string | null): boolean {
  return estado === "Finalizado";
}

export function tareaCerrada(estado: string | null): boolean {
  return estado === "Completada" || estado === "Cancelada";
}

/** Serial legible mientras el campo ID no sea fórmula en Airtable. */
export function codigoDesdeSerial(
  prefijo: string,
  serial: number | null,
): string | null {
  return serial === null ? null : `${prefijo}-${String(serial).padStart(4, "0")}`;
}

/* -------------------------------- Avance -------------------------------- */

type TareaMinima = {
  estado: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
};

export type Avance = {
  /** Tareas que cuentan: las canceladas no son trabajo pendiente ni hecho. */
  total: number;
  completadas: number;
  /** 0–100, redondeado; null si el proyecto no tiene tareas que contar. */
  porcentaje: number | null;
  vencidas: number;
};

export function calcularAvance(tareas: TareaMinima[], hoy: string): Avance {
  const vigentes = tareas.filter((tarea) => tarea.estado !== "Cancelada");
  const completadas = vigentes.filter(
    (tarea) => tarea.estado === "Completada",
  ).length;

  return {
    total: vigentes.length,
    completadas,
    porcentaje:
      vigentes.length === 0
        ? null
        : Math.round((completadas / vigentes.length) * 100),
    vencidas: tareas.filter((tarea) => alertaTarea(tarea, hoy) === "vencida")
      .length,
  };
}

export type AlertaTarea =
  | "vencida"
  | "hoy"
  | "en-plazo"
  | "sin-fecha"
  | "cerrada";

export function alertaTarea(tarea: TareaMinima, hoy: string): AlertaTarea {
  if (tareaCerrada(tarea.estado)) return "cerrada";
  if (!tarea.fechaFin) return "sin-fecha";
  if (tarea.fechaFin < hoy) return "vencida";
  if (tarea.fechaFin === hoy) return "hoy";
  return "en-plazo";
}

/** Un proyecto abierto que ya pasó su fecha de fin planeada. */
export function proyectoAtrasado(
  proyecto: { estado: string | null; fechaFinPlaneada: string | null },
  hoy: string,
): boolean {
  return (
    !proyectoCerrado(proyecto.estado) &&
    proyecto.fechaFinPlaneada !== null &&
    proyecto.fechaFinPlaneada < hoy
  );
}

/* ------------------------------ Cronograma ------------------------------ */

const DIA_MS = 86_400_000;

/** Días entre dos fechas YYYY-MM-DD, sin pasar por la zona horaria local. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / DIA_MS);
}

function aUtc(fecha: string): number {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(aUtc(fecha) + dias * DIA_MS).toISOString().slice(0, 10);
}

/**
 * La ventana que dibuja el cronograma: del primer inicio al último fin entre
 * el proyecto y sus tareas. null cuando no hay ninguna fecha que ubicar.
 */
export function rangoCronograma(
  proyecto: { fechaInicio: string | null; fechaFinPlaneada: string | null },
  tareas: TareaMinima[],
): { inicio: string; fin: string; dias: number } | null {
  const fechas = [
    proyecto.fechaInicio,
    proyecto.fechaFinPlaneada,
    ...tareas.flatMap((tarea) => [tarea.fechaInicio, tarea.fechaFin]),
  ].filter((fecha): fecha is string => Boolean(fecha));

  if (fechas.length === 0) return null;

  fechas.sort();
  const inicio = fechas[0];
  const fin = fechas[fechas.length - 1];
  // Un día de más para que la barra del último día tenga ancho.
  return { inicio, fin, dias: diasEntre(inicio, fin) + 1 };
}

/* ------------------------------- Permisos ------------------------------- */

type Sesion = { idEmpleado: string; nombre: string };

/**
 * Quién ve un proyecto: el equipo de mando, su líder y quien tenga alguna de
 * sus tareas. El encargado de una tarea necesita el contexto de la prueba
 * — objetivo, metodología, fechas — para hacer bien su parte.
 */
export function participaEnProyecto(
  permisos: Permisos,
  proyecto: Autor,
  tareasDelProyecto: Autor[],
  sesion: Sesion,
): boolean {
  if (permisos.verTodo) return true;
  if (!permisos.leerPropio) return false;
  return (
    esDeLaSesion(proyecto, sesion) ||
    tareasDelProyecto.some((tarea) => esDeLaSesion(tarea, sesion))
  );
}

/** Editar el proyecto, crear y reasignar tareas: el líder o el mando. */
export function puedeGestionarProyecto(
  permisos: Permisos,
  proyecto: Autor,
  sesion: Sesion,
): boolean {
  if (permisos.actualizarTodo) return true;
  return permisos.actualizarPropio && esDeLaSesion(proyecto, sesion);
}

/**
 * Mover el estado de una tarea y anotar su resultado: quien gestiona el
 * proyecto o el encargado de esa tarea.
 */
export function puedeAvanzarTarea(
  permisos: Permisos,
  proyecto: Autor,
  tarea: Autor,
  sesion: Sesion,
): boolean {
  if (puedeGestionarProyecto(permisos, proyecto, sesion)) return true;
  return permisos.actualizarPropio && esDeLaSesion(tarea, sesion);
}

/* --------------------------- Lectura de entrada -------------------------- */

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export type ErrorEntrada = { error: string };

export function esErrorEntrada<T>(valor: T | ErrorEntrada): valor is ErrorEntrada {
  return typeof valor === "object" && valor !== null && "error" in valor;
}

function cadena(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

function normalizarNombre(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function fecha(valor: unknown): string | null | "invalida" {
  const limpia = cadena(valor);
  if (!limpia) return null;
  return FECHA.test(limpia) ? limpia : "invalida";
}

/** Lo que se diligencia de un proyecto, ya validado. */
export type DatosProyectoEntrada = {
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

/**
 * Valida el cuerpo de crear o corregir un proyecto. Los productos llegan como
 * seriales y se cruzan contra el catálogo completo: el nombre que se guarda
 * sale de ahí, no de lo que mande el navegador.
 */
export function leerDatosProyecto(
  body: Record<string, unknown>,
  catalogo: { codigo: string; nombre: string }[],
): DatosProyectoEntrada | ErrorEntrada {
  const nombre = cadena(body.nombre);
  const objetivo = cadena(body.objetivo);
  const fechaInicio = fecha(body.fechaInicio);
  const fechaFinPlaneada = fecha(body.fechaFinPlaneada);

  if (!nombre) return { error: "Ponle un nombre al proyecto." };
  if (!objetivo) return { error: "Escribe el objetivo de la prueba." };
  if (fechaInicio === "invalida") return { error: "Fecha de inicio inválida." };
  if (fechaFinPlaneada === "invalida") {
    return { error: "Fecha de fin inválida." };
  }
  if (fechaInicio && fechaFinPlaneada && fechaFinPlaneada < fechaInicio) {
    return { error: "La fecha de fin no puede ser anterior al inicio." };
  }

  // Se acepta el código o el nombre exacto: el dashboard manda códigos, pero
  // el conector MCP de alguien sin acceso al catálogo solo tiene el nombre
  // que dijo la persona.
  const pedidos = Array.isArray(body.productos)
    ? body.productos.filter((v): v is string => typeof v === "string")
    : [];
  const elegidos: { codigo: string; nombre: string }[] = [];
  for (const pedido of pedidos) {
    const producto = catalogo.find(
      (p) =>
        p.codigo === pedido.trim() ||
        normalizarNombre(p.nombre) === normalizarNombre(pedido),
    );
    if (!producto) {
      return { error: `«${pedido}» no está en el catálogo de productos.` };
    }
    if (!elegidos.includes(producto)) elegidos.push(producto);
  }
  // En el orden del catálogo, para que guardar dos veces lo mismo no
  // aparezca en el historial como un cambio.
  elegidos.sort((a, b) => catalogo.indexOf(a) - catalogo.indexOf(b));

  return {
    nombre,
    cultivo: cadena(body.cultivo),
    ubicacion: cadena(body.ubicacion),
    idProductosCore: elegidos.map((p) => p.codigo).join(", ") || null,
    productos: elegidos.map((p) => p.nombre).join(", ") || null,
    objetivo,
    metodologia: cadena(body.metodologia),
    indicadores: cadena(body.indicadores),
    fechaInicio,
    fechaFinPlaneada,
    observaciones: cadena(body.observaciones),
  };
}

/** Lo que se diligencia de una tarea, salvo el encargado (que se resuelve aparte). */
export type DatosTareaEntrada = {
  tarea: string;
  descripcion: string | null;
  idEncargado: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
};

export function leerDatosTarea(
  body: Record<string, unknown>,
): DatosTareaEntrada | ErrorEntrada {
  const tarea = cadena(body.tarea);
  const fechaInicio = fecha(body.fechaInicio);
  const fechaFin = fecha(body.fechaFin);

  if (!tarea) return { error: "Escribe qué hay que hacer." };
  if (fechaInicio === "invalida") return { error: "Fecha de inicio inválida." };
  if (fechaFin === "invalida") return { error: "Fecha de fin inválida." };
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    return { error: "La fecha de fin no puede ser anterior al inicio." };
  }

  return {
    tarea,
    descripcion: cadena(body.descripcion),
    idEncargado: cadena(body.encargadoId),
    fechaInicio,
    fechaFin,
  };
}

/** Valida un cierre o corrección de resultados. */
export function leerCierre(
  body: Record<string, unknown>,
  estadoFinal: string | null,
  actual: { resultados: string | null; veredicto: string | null },
):
  | { resultados: string | null; veredicto: Veredicto | null; conclusion: string | null }
  | ErrorEntrada {
  const resultados = cadena(body.resultados);
  const conclusion = cadena(body.conclusion);
  const veredictoTexto = cadena(body.veredicto);

  if (veredictoTexto && !VEREDICTOS.includes(veredictoTexto as Veredicto)) {
    return { error: "Veredicto inválido." };
  }
  const veredicto = veredictoTexto as Veredicto | null;

  if (exigeResultados(estadoFinal)) {
    if (!resultados && !actual.resultados) {
      return {
        error: "Para finalizar la prueba, escribe los resultados que se midieron.",
      };
    }
    if (!veredicto && !actual.veredicto) {
      return { error: "Para finalizar la prueba, elige el veredicto." };
    }
  }

  return { resultados, veredicto, conclusion };
}
