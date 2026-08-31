/**
 * Puntos de extensión para las integraciones futuras del módulo de pedidos.
 *
 * Aquí no hay implementación y es a propósito: WhatsApp, DataLab y las
 * notificaciones dependen de APIs, credenciales y reglas de negocio que
 * todavía no están definidas, y una implementación adivinada sería peor que
 * ninguna. Lo que sí se puede fijar hoy es la **forma** del enchufe, para que
 * el día que lleguen esos datos no haya que reescribir el módulo.
 *
 * Ver `INTEGRACIONES.md` para el contexto y las preguntas abiertas.
 */

import type { EntradaPedido } from "@/lib/pedidos";

/* --------------------------- Entrada de pedidos -------------------------- */

/**
 * De dónde viene un pedido. Hoy la base tiene `Origen del Pedido` con dos
 * opciones —DataLab (Laboratorio) y PiroliApp (Pirolisis)—; el CRM sumará la
 * suya cuando exista la conversión desde una venta.
 */
export type OrigenExterno = "whatsapp" | "datalab" | "crm";

/** Lo que una fuente externa entrega, antes de convertirse en pedido. */
export type SolicitudExterna = {
  origen: OrigenExterno;
  /**
   * Identificador del mensaje o registro en el sistema de origen. Es la llave
   * de idempotencia: la misma solicitud no puede crear dos pedidos, igual que
   * una venta no puede generar dos. Sin esto, un reintento de webhook duplica.
   */
  referenciaExterna: string;
  /** Cuándo se recibió, en ISO. No es la fecha del pedido. */
  recibidoEn: string;
  /** El contenido tal como llegó, para poder auditar lo que se interpretó. */
  crudo: unknown;
};

/**
 * Traduce lo que llega de fuera al pedido que el CRM sabe crear.
 *
 * Devuelve `null` cuando la solicitud no es un pedido (un "gracias" por
 * WhatsApp no lo es), y lanza solo si el contenido está roto.
 *
 * Quien la implemente **no debe escribir en Airtable**: eso lo hace
 * `crearPedido`, que es el único camino de escritura y el que ya resuelve
 * seriales, líneas y errores parciales.
 */
export type FuentePedido = {
  origen: OrigenExterno;
  interpretar(
    solicitud: SolicitudExterna,
  ): Promise<Omit<EntradaPedido, "idPersonalCore"> | null>;
};

/* ----------------------------- Notificaciones ---------------------------- */

/** Lo que un área necesita saber cuando algo pasa con un pedido suyo. */
export type AvisoPedido = {
  /** Serial del pedido, formato SIRIUS-PED-XXXX. */
  idPedido: string;
  /** Área responsable: Laboratorio, Pirolisis u otra. */
  area: string;
  suceso: "creado" | "cambio-estado" | "cancelado";
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  /** ID Empleado de quien provocó el cambio. */
  autorId: string;
};

/**
 * Avisa al área responsable. Se invoca **después** de que Airtable confirmó la
 * escritura, nunca antes: un aviso de algo que no se guardó es peor que no
 * avisar.
 *
 * Un fallo al notificar no debe tumbar la operación — el pedido ya existe —,
 * así que la implementación tiene que tragarse sus errores y registrarlos.
 */
export type NotificadorArea = {
  nombre: string;
  avisar(aviso: AvisoPedido): Promise<void>;
};

/* ------------------------------- Registro -------------------------------- */

/**
 * Las integraciones activas. Vacío a propósito: cada una se registra aquí
 * cuando exista, y así el resto del código no tiene que saber cuáles hay.
 */
export const FUENTES_PEDIDO: FuentePedido[] = [];
export const NOTIFICADORES: NotificadorArea[] = [];

/**
 * Avisa a todos los notificadores registrados. Sin ninguno no hace nada, que
 * es el estado de hoy.
 *
 * Se llamaría desde `PATCH /api/pedidos/[id]` y desde la conversión de venta,
 * justo después de `invalidar(ETIQUETAS.pedidos)`.
 */
export async function notificarArea(aviso: AvisoPedido): Promise<void> {
  await Promise.all(
    NOTIFICADORES.map(async (notificador) => {
      try {
        await notificador.avisar(aviso);
      } catch (error) {
        // El pedido ya se guardó: un aviso fallido se registra, no se propaga.
        console.error(`notificar ${notificador.nombre}`, error);
      }
    }),
  );
}
