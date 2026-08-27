/**
 * Lo que de Casos comparten el cliente y el servidor: las opciones del select
 * y los cálculos puros. Vive aparte de `casos.ts` para que un componente
 * `"use client"` no arrastre la capa de Airtable al bundle del navegador.
 */

export const TIPOS_CASO = [
  "Comercial",
  "Técnico o agronómico",
  "Queja o reclamo",
  "Solicitud de información",
  "Otro",
] as const;

export const ESTADOS_CASO = [
  "Abierto",
  "En proceso",
  "Resuelto",
  "Cerrado",
] as const;

export type TipoCaso = (typeof TIPOS_CASO)[number];
export type EstadoCaso = (typeof ESTADOS_CASO)[number];

export type AlertaSla = "vencido" | "hoy" | "en-plazo" | "sin-plazo" | "cerrado";

/** Un caso deja de exigir acción del equipo cuando se resuelve o se cierra. */
export function estaCerrado(estado: string | null): boolean {
  return estado === "Resuelto" || estado === "Cerrado";
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
