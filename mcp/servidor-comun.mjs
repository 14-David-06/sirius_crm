/**
 * El servidor MCP del CRM, sin transporte.
 *
 * Aquí vive lo que comparten las dos formas de conectarse —el proceso stdio
 * local (`mcp/servidor.mjs`) y el endpoint remoto (`/api/mcp`)—: las mismas 16
 * herramientas y las mismas instrucciones. Cambiar de transporte no debería
 * cambiar lo que Claude puede hacer, así que solo hay una definición de eso.
 *
 * `api` es el cliente del CRM ya autenticado; de dónde salió su sesión es
 * asunto de quien llama.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registrarLectura } from "./herramientas-lectura.mjs";
import { registrarEscritura } from "./herramientas-escritura.mjs";

const INSTRUCCIONES =
  "Este servidor da acceso al CRM de Sirius Regenerative: clientes, contactos, visitas " +
  "comerciales, casos PQRSF, pedidos y catálogo de productos.\n\n" +
  "Cómo usarlo bien:\n" +
  "- `crm_quien_soy` primero si importa el alcance: según el nivel de acceso, las listas " +
  "traen los registros de todo el equipo o solo los de esta persona. Una lista corta " +
  "puede ser un permiso, no un dato faltante.\n" +
  "- Los clientes y los productos se pueden nombrar en español corriente; las " +
  "herramientas los resuelven contra el maestro y avisan cuando hay ambigüedad en vez " +
  "de adivinar.\n" +
  "- `crm_resumen` responde de una sola vez casi todo lo que suena a «cómo vamos»: " +
  "KPIs, pendientes atrasados, seguimientos y actividad reciente.\n" +
  "- Las fechas son `YYYY-MM-DD` y la zona de referencia es Bogotá.\n" +
  "- Antes de escribir, confirma con la persona el cliente y la fecha: lo que se " +
  "registra queda en Airtable y lo lee el resto del equipo.";

export const VERSION = "1.0.0";

export function construirServidor({ api, soloLectura = false }) {
  const servidor = new McpServer(
    { name: "sirius-crm", version: VERSION },
    { instructions: INSTRUCCIONES },
  );

  registrarLectura(servidor, api);
  if (!soloLectura) {
    registrarEscritura(servidor, api);
  }

  return servidor;
}
