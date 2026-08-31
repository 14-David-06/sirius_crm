/**
 * Lo que de Sirius Clients Core comparten el cliente y el servidor. Vive
 * aparte de `clientes.ts` para que los formularios `"use client"` no arrastren
 * la capa de Airtable al bundle del navegador.
 */

/**
 * Área del contacto dentro de la empresa cliente. El cargo sigue siendo texto
 * libre —cada empresa lo nombra a su manera—; la función es la clasificación
 * estable con la que se decide a quién escribirle: una cotización va a
 * Compras, una factura a Facturación.
 *
 * Una misma persona puede cumplir varias: en empresas pequeñas quien compra
 * es quien paga.
 */
export const TIPOS_CONTACTO = [
  "Gerencia",
  "Técnico",
  "Compras",
  "Facturación",
  "Pagos",
] as const;

export type TipoContacto = (typeof TIPOS_CONTACTO)[number];

/** Normaliza lo que venga de Airtable a uno de los tipos conocidos. */
export function reconocerTipoContacto(
  valor: string | null | undefined,
): TipoContacto | null {
  const limpio = valor?.trim().toLowerCase();
  if (!limpio) return null;
  return (
    TIPOS_CONTACTO.find((tipo) => tipo.toLowerCase() === limpio) ?? null
  );
}

/**
 * Normaliza una lista de funciones: descarta lo desconocido, quita repetidos
 * y respeta el orden de `TIPOS_CONTACTO` para que la interfaz sea estable.
 */
export function reconocerFunciones(valor: unknown): TipoContacto[] {
  const crudas = Array.isArray(valor) ? valor : [valor];
  const reconocidas = new Set<TipoContacto>();

  for (const cruda of crudas) {
    const tipo = reconocerTipoContacto(
      typeof cruda === "string" ? cruda : null,
    );
    if (tipo) reconocidas.add(tipo);
  }

  return TIPOS_CONTACTO.filter((tipo) => reconocidas.has(tipo));
}

/**
 * Lee las funciones que llegan de un formulario. Devuelve "invalido" si
 * alguna no es una de las definidas: a diferencia de `reconocerFunciones`,
 * que limpia lo que ya está guardado en Airtable, aquí un valor extraño es un
 * error del cliente y se contesta con un mensaje, no se descarta en silencio.
 */
export function leerFunciones(valor: unknown): TipoContacto[] | "invalido" {
  if (valor === undefined || valor === null) return [];

  const crudas = (Array.isArray(valor) ? valor : [valor]).filter(
    (cruda) => typeof cruda === "string" && cruda.trim(),
  );

  for (const cruda of crudas) {
    if (!reconocerTipoContacto(cruda as string)) return "invalido";
  }

  return reconocerFunciones(crudas);
}

/* ------------------------- ¿Cómo conoció a Sirius? ----------------------- */

/**
 * Por dónde llegó el cliente. Alimenta la pregunta de la ficha y, más
 * adelante, el reporte de qué canal trae más clientes.
 */
export const CANALES_CONOCIMIENTO = [
  "Página web",
  "WhatsApp",
  "Referido",
  "Feria o evento",
  "Gestión comercial",
  "Otro",
] as const;

export type CanalConocimiento = (typeof CANALES_CONOCIMIENTO)[number];

/** El único canal que pide explicación escrita. */
export const CANAL_OTRO: CanalConocimiento = "Otro";

export function reconocerCanal(
  valor: string | null | undefined,
): CanalConocimiento | null {
  const limpio = valor?.trim().toLowerCase();
  if (!limpio) return null;
  return (
    CANALES_CONOCIMIENTO.find((canal) => canal.toLowerCase() === limpio) ?? null
  );
}

/**
 * Cómo se muestra el canal en la ficha: "Otro" sin el detalle no dice nada,
 * así que se imprime junto.
 */
export function describirCanal(
  canal: string | null,
  detalle: string | null,
): string | null {
  if (!canal) return null;
  if (canal === CANAL_OTRO && detalle) return `${canal} — ${detalle}`;
  return canal;
}
