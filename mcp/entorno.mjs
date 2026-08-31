/**
 * La configuración del conector, leída del mismo `.env.local` que usa el CRM.
 *
 * Se lee del archivo y no solo de `process.env` porque quien arranca el
 * servidor MCP es Claude, no una terminal: no hay shell donde exportar nada.
 * Un `.env.local` que ya existe, ya está en `.gitignore` y ya guarda secretos
 * es el lugar natural para las credenciales del conector.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Parser mínimo de dotenv: `CLAVE=valor`, comillas opcionales, `#` comenta. */
function leerArchivo(ruta) {
  let contenido;
  try {
    contenido = readFileSync(ruta, "utf8");
  } catch {
    return {};
  }

  const valores = {};
  for (const linea of contenido.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;

    const corte = limpia.indexOf("=");
    if (corte < 1) continue;

    const clave = limpia.slice(0, corte).trim();
    let valor = limpia.slice(corte + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    valores[clave] = valor;
  }
  return valores;
}

// El entorno del proceso manda: permite sobrescribir sin tocar el archivo.
const archivo = {
  ...leerArchivo(resolve(RAIZ, ".env")),
  ...leerArchivo(resolve(RAIZ, ".env.local")),
};

function leer(nombre) {
  const valor = process.env[nombre] ?? archivo[nombre];
  return valor?.trim() ? valor.trim() : null;
}

function obligatorio(nombre, ayuda) {
  const valor = leer(nombre);
  if (!valor) {
    throw new Error(
      `Falta ${nombre} en .env.local (o en el entorno). ${ayuda}`,
    );
  }
  return valor;
}

export const config = {
  /** Sin barra final, para que las rutas se peguen sin duplicarla. */
  get url() {
    return (leer("CRM_MCP_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
  },
  get cedula() {
    return obligatorio(
      "CRM_MCP_CEDULA",
      "Es la cédula con la que entras al CRM; el conector hereda tu nivel de acceso.",
    );
  },
  get password() {
    return obligatorio(
      "CRM_MCP_PASSWORD",
      "Es la contraseña de esa cédula en el CRM.",
    );
  },
  /** Cuando es false el conector no expone ninguna herramienta de escritura. */
  get soloLectura() {
    const valor = leer("CRM_MCP_SOLO_LECTURA");
    return valor === "1" || valor?.toLowerCase() === "true";
  },
};
