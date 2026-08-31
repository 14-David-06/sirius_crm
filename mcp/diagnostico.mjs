#!/usr/bin/env node
/**
 * Comprueba la configuración del conector sin pasar por Claude.
 *
 * Es la primera cosa que hay que correr cuando el conector "no funciona":
 * separa los tres problemas que se ven igual desde el cliente MCP —el CRM no
 * responde, la contraseña no sirve, el nivel de acceso no alcanza— y dice cuál
 * de los tres es.
 *
 *   npm run mcp:diagnostico
 */

import { clienteConLogin } from "./cliente-crm.mjs";
import { config } from "./entorno.mjs";

const api = clienteConLogin({
  url: config.url,
  credenciales: () => ({ cedula: config.cedula, password: config.password }),
});

function linea(etiqueta, valor) {
  console.log(`  ${etiqueta.padEnd(22)} ${valor}`);
}

console.log(`\nCRM: ${config.url}`);

try {
  // Basta con leer la sesión: si esto responde, el login funcionó.
  const { sesion, permisos, puede } = await api.obtener("/api/sesion");

  console.log("\nSesión del conector");
  linea("Nombre", sesion.nombre);
  linea("ID empleado", sesion.idEmpleado);
  linea("Rol", sesion.rol ?? "sin rol");
  linea("Nivel de acceso", sesion.nivelAcceso ?? "SIN NIVEL ASIGNADO");

  console.log("\nQué puede hacer Claude a través del conector");
  for (const { etiqueta, permitido } of puede) {
    linea(permitido ? "sí" : "no", etiqueta);
  }

  if (config.soloLectura) {
    console.log(
      "\n  CRM_MCP_SOLO_LECTURA está activo: las herramientas de escritura no se exponen,",
    );
    console.log("  aunque el nivel de acceso las permitiría.");
  }

  if (!permisos.verTodo) {
    console.log(
      "\n  Este nivel solo ve sus propios registros. Las listas saldrán cortas y el",
    );
    console.log("  maestro de clientes vendrá recortado: es el permiso, no un error.");
  }

  const modulos = [
    ["visitas", "/api/visitas"],
    ["casos", "/api/casos"],
    ["pedidos", "/api/pedidos"],
    ["productos", "/api/productos"],
    ["contactos", "/api/contactos"],
    ["clientes", "/api/clientes"],
  ];

  console.log("\nLectura de cada módulo");
  for (const [nombre, ruta] of modulos) {
    try {
      const datos = await api.obtener(ruta);
      const lista = Object.values(datos).find(Array.isArray) ?? [];
      linea(nombre, `${lista.length} registros`);
    } catch (error) {
      linea(nombre, `— ${error.message}`);
    }
  }

  console.log("\nTodo listo.\n");
} catch (error) {
  console.error(`\nNo pudimos conectar: ${error.message}\n`);
  console.error("Revisa, en este orden:");
  console.error(
    `  1. Que el CRM esté arriba en ${config.url} (si es local, 'npm run dev').`,
  );
  console.error(
    "  2. Que CRM_MCP_CEDULA y CRM_MCP_PASSWORD en .env.local sean las de entrada al CRM.",
  );
  console.error(
    "  3. Que esa persona esté activa y tenga nivel de acceso en Sirius Nomina Core.\n",
  );
  process.exitCode = 1;
}
