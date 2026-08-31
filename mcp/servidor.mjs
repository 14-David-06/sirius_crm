#!/usr/bin/env node
/**
 * El conector MCP del CRM en su forma local: un proceso por stdio.
 *
 * Lo arranca el cliente (Claude Code, Claude Desktop) y muere con él. Entra al
 * CRM con la cédula y la contraseña del `.env.local`, así que su techo es el
 * nivel de acceso de esa persona.
 *
 * Para que lo use el equipo desde claude.ai o el celular está el endpoint
 * remoto `/api/mcp`, que expone estas mismas herramientas con OAuth. Este
 * proceso sigue siendo el camino corto para desarrollo contra `localhost`, sin
 * pasar por el flujo de autorización.
 *
 * Configuración, en `.env.local` de la raíz del repo:
 *
 *   CRM_MCP_URL=http://localhost:3000   (o la URL de producción)
 *   CRM_MCP_CEDULA=...
 *   CRM_MCP_PASSWORD=...
 *   CRM_MCP_SOLO_LECTURA=1              (opcional: quita las herramientas de escritura)
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { clienteConLogin } from "./cliente-crm.mjs";
import { config } from "./entorno.mjs";
import { construirServidor } from "./servidor-comun.mjs";

const servidor = construirServidor({
  api: clienteConLogin({
    url: config.url,
    credenciales: () => ({ cedula: config.cedula, password: config.password }),
  }),
  soloLectura: config.soloLectura,
});

// stdout es el canal del protocolo: cualquier cosa que se imprima ahí lo rompe.
// Los avisos van a stderr, que el cliente muestra como log del servidor.
console.error(
  `[sirius-crm] listo contra ${config.url}` +
    (config.soloLectura ? " (solo lectura)" : ""),
);

await servidor.connect(new StdioServerTransport());
