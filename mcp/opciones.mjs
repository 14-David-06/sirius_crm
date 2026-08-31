/**
 * Las listas de opciones que el CRM acepta, copiadas de `src/lib/*-comun.ts`.
 *
 * Se copian y no se importan porque este servidor corre en Node plano, sin el
 * compilador de TypeScript ni el alias `@/` de Next. La copia es exactamente lo
 * que se desfasa en silencio, así que `src/lib/opciones-mcp.test.ts` compara
 * este archivo contra las constantes reales y falla si alguien agrega una
 * opción en Airtable y solo actualiza un lado.
 *
 * Sirven para dos cosas: describirle las opciones a quien llama la herramienta
 * —un enum en el esquema evita una ronda de ensayo y error— y nada más. La
 * validación de verdad sigue siendo la del CRM.
 */

export const TIPOS_VISITA = ["Presencial", "Virtual", "Llamada"];

export const RESULTADOS_VISITA = [
  "Interesado",
  "Cotización enviada",
  "Venta cerrada",
  "Seguimiento pendiente",
  "Sin interés por ahora",
];

/** La clasificación con la que se abren los casos nuevos. */
export const TIPOS_PQRSF = [
  "Petición",
  "Queja",
  "Reclamo",
  "Sugerencia",
  "Felicitación",
  "Otro",
];

/** Los tipos anteriores siguen siendo válidos al editar un caso viejo. */
export const TIPOS_CASO_ANTERIORES = [
  "Comercial",
  "Técnico o agronómico",
  "Queja o reclamo",
  "Solicitud de información",
];

export const TIPOS_CASO = [...TIPOS_PQRSF, ...TIPOS_CASO_ANTERIORES];

export const ESTADOS_CASO = ["Abierto", "En proceso", "Resuelto", "Cerrado"];

export const ESTADOS_PEDIDO = [
  "Recibido",
  "Procesando",
  "Enviado Parcial",
  "Enviado",
  "Completado",
  "Cancelado",
];

/** Un pedido en estos estados ya no admite cambios. */
export const ESTADOS_PEDIDO_CERRADOS = ["Completado", "Cancelado"];

export const ESTADOS_PEDIDO_ABIERTOS = ESTADOS_PEDIDO.filter(
  (estado) => !ESTADOS_PEDIDO_CERRADOS.includes(estado),
);

export const CATEGORIAS_APLICACION = [
  "Preventivo Marchitez Letal (ML)",
  "Preventivo Control Plagas",
  "Preventivo PC",
  "Preventivo Pestalotiopsis",
  "Otro",
];
