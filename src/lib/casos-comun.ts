/**
 * Lo que de Casos comparten el cliente y el servidor: las opciones del select
 * y los cálculos puros. Vive aparte de `casos.ts` para que un componente
 * `"use client"` no arrastre la capa de Airtable al bundle del navegador.
 */

/**
 * La clasificación PQRSF, que es la que pide el proceso de atención al
 * cliente. "Otro" cubre el resto de comentarios.
 */
export const TIPOS_PQRSF = [
  "Petición",
  "Queja",
  "Reclamo",
  "Sugerencia",
  "Felicitación",
  "Otro",
] as const;

/**
 * La clasificación con la que se abrieron los casos anteriores. Se conserva
 * para no dejar huérfanos los registros que ya la usan: siguen siendo válidos
 * al editarlos, pero al abrir un caso nuevo se ofrece PQRSF.
 */
export const TIPOS_CASO_ANTERIORES = [
  "Comercial",
  "Técnico o agronómico",
  "Queja o reclamo",
  "Solicitud de información",
] as const;

export const TIPOS_CASO = [
  ...TIPOS_PQRSF,
  ...TIPOS_CASO_ANTERIORES,
] as const;

export const ESTADOS_CASO = [
  "Abierto",
  "En proceso",
  "Resuelto",
  "Cerrado",
] as const;

export type TipoPqrsf = (typeof TIPOS_PQRSF)[number];
export type TipoCaso = (typeof TIPOS_CASO)[number];
export type EstadoCaso = (typeof ESTADOS_CASO)[number];

export type AlertaSla = "vencido" | "hoy" | "en-plazo" | "sin-plazo" | "cerrado";

/** Un caso deja de exigir acción del equipo cuando se resuelve o se cierra. */
export function estaCerrado(estado: string | null): boolean {
  return estado === "Resuelto" || estado === "Cerrado";
}

/**
 * Cerrar un caso sin decir qué se le respondió al cliente lo deja inservible
 * como registro: dentro de un mes nadie sabrá cómo se resolvió.
 */
export function exigeSolucion(estado: string | null): boolean {
  return estaCerrado(estado);
}

export function alertaPorFecha(
  estado: string | null,
  fechaLimite: string | null,
  hoy: string,
): AlertaSla {
  if (estaCerrado(estado)) return "cerrado";
  if (!fechaLimite) return "sin-plazo";
  if (fechaLimite < hoy) return "vencido";
  if (fechaLimite === hoy) return "hoy";
  return "en-plazo";
}

/* ------------------------------- Historial ------------------------------- */

/**
 * Agrega una línea a la bitácora del caso.
 *
 * Solo se agrega, nunca se reescribe: el historial es la respuesta a "¿quién
 * cambió esto y cuándo?", y un historial que se puede editar no responde nada.
 * Las líneas nuevas van al final, que es como se lee una bitácora.
 */
export function anotarHistorial(
  historialActual: string | null,
  linea: string,
  fecha: string,
  autorId: string,
): string {
  const entrada = `[${fecha}] ${autorId || "sin ID"} · ${linea}`;
  return historialActual?.trim()
    ? `${historialActual.trimEnd()}\n${entrada}`
    : entrada;
}

/** Describe un cambio de campo para la bitácora, o null si no cambió nada. */
export function describirCambio(
  etiqueta: string,
  antes: string | null,
  despues: string | null,
): string | null {
  const a = antes?.trim() || null;
  const b = despues?.trim() || null;
  if (a === b) return null;
  if (a === null) return `${etiqueta}: se agregó`;
  if (b === null) return `${etiqueta}: se borró`;
  // Los textos largos no se copian enteros: la bitácora quedaría ilegible.
  return a.length > 40 || b.length > 40
    ? `${etiqueta}: cambió`
    : `${etiqueta}: «${a}» → «${b}»`;
}
