/**
 * Lo que de Visitas comparten el cliente y el servidor. Vive aparte de
 * `crm.ts` para que los formularios `"use client"` no arrastren la capa de
 * Airtable al bundle del navegador.
 */

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
