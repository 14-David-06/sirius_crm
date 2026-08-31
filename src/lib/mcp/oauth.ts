/**
 * OAuth 2.1 para el conector MCP remoto.
 *
 * El CRM es a la vez el servidor de autorización y el servidor de recursos:
 * quien se conecta desde claude.ai entra con su propia cédula y contraseña del
 * CRM, y el conector queda con SU sesión y SU nivel de acceso. No hay una
 * cuenta de servicio compartida, que es justo lo que había que evitar.
 *
 * ## Por qué no hay base de datos
 *
 * Todo lo que OAuth necesita recordar —el cliente registrado, el código de
 * autorización, el token— va firmado dentro del propio valor. En Vercel cada
 * petición puede caer en una lambda distinta, así que cualquier cosa guardada
 * en memoria se pierde y montar Redis solo para esto sería infraestructura
 * nueva que hay que operar. Un JWT firmado es el mismo dato, sin servidor
 * detrás.
 *
 * Lo que eso cuesta está abajo, en "Revocación".
 *
 * ## De dónde sale la clave
 *
 * De `SESSION_SECRET`, pero derivada con HKDF y una etiqueta distinta por uso.
 * Así no hay una variable de entorno más que configurar, y a la vez un token de
 * acceso no puede pasar por cookie de sesión ni al revés: son claves distintas
 * aunque nazcan del mismo secreto.
 *
 * ## Revocación
 *
 * Un token firmado no se puede "borrar". Lo que sí ocurre es que la identidad
 * se vuelve a leer de Airtable en cada llamada (`personaParaSesion`), así que:
 *
 *   - Inactivar a la persona en Sirius Nomina Core corta el acceso.
 *   - Bajarle el nivel se refleja igual de rápido.
 *   - Rotar `SESSION_SECRET` invalida todos los tokens de golpe (y también
 *     todas las sesiones del dashboard).
 *
 * Los tokens de acceso duran una hora justamente para que esa ventana sea
 * corta.
 */

import { hkdfSync } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

import { env } from "@/lib/env";

/** El único scope que se concede siempre; escribir es opcional. */
export const SCOPE_LEER = "crm.leer";
export const SCOPE_ESCRIBIR = "crm.escribir";
export const SCOPES = [SCOPE_LEER, SCOPE_ESCRIBIR] as const;

const VIDA = {
  /** Lo justo para ir del navegador al token endpoint. */
  codigo: 60,
  /** Corto a propósito: es la ventana en la que un token robado sirve. */
  acceso: 60 * 60,
  refresco: 60 * 60 * 24 * 30,
} as const;

export const VIDA_ACCESO_SEGUNDOS = VIDA.acceso;

type Uso = "cliente" | "codigo" | "acceso" | "refresco";

/**
 * Una clave por uso, derivada del secreto de sesión.
 *
 * HKDF con `info` distinto da claves independientes: aunque las cuatro salgan
 * del mismo `SESSION_SECRET`, firmar un código de autorización no permite
 * fabricar un token de acceso.
 */
function clave(uso: Uso): Uint8Array {
  return new Uint8Array(
    hkdfSync("sha256", env.sessionSecret, "sirius-mcp-oauth", uso, 32),
  );
}

async function firmar(
  uso: Uso,
  datos: JWTPayload,
  segundos: number,
): Promise<string> {
  return new SignJWT({ ...datos, uso })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${segundos}s`)
    .sign(clave(uso));
}

/** Devuelve null en vez de lanzar: un token inválido es un 401, no un 500. */
async function verificar(uso: Uso, token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, clave(uso));
    // El `uso` va firmado dentro además de decidir la clave, así que un token
    // de otro tipo no pasa ni por accidente si algún día comparten clave.
    return payload.uso === uso ? payload : null;
  } catch {
    return null;
  }
}

/* --------------------------- Cliente registrado --------------------------- */

/**
 * Un cliente MCP se registra solo (RFC 7591): claude.ai llama a `/api/oauth/
 * register` y recibe un `client_id`. Aquí ese `client_id` *es* el registro,
 * firmado, así que no hay nada que guardar ni que limpiar después.
 */
export type ClienteRegistrado = {
  redirectUris: string[];
  nombre: string | null;
};

export function registrarCliente(
  cliente: ClienteRegistrado,
): Promise<string> {
  // Sin expiración: un cliente registrado hoy tiene que seguir sirviendo el
  // mes que viene. `exp` se pone igualmente muy lejos para que jose no
  // rechace la falta del campo.
  return firmar(
    "cliente",
    { ru: cliente.redirectUris, nom: cliente.nombre },
    60 * 60 * 24 * 365 * 5,
  );
}

export async function leerCliente(
  clientId: string,
): Promise<ClienteRegistrado | null> {
  const datos = await verificar("cliente", clientId);
  if (!datos || !Array.isArray(datos.ru)) return null;

  return {
    redirectUris: datos.ru.filter((uri): uri is string => typeof uri === "string"),
    nombre: typeof datos.nom === "string" ? datos.nom : null,
  };
}

/* ------------------------- Código de autorización ------------------------- */

export type DatosCodigo = {
  /** Cédula de quien autorizó; la identidad se relee en cada llamada. */
  cedula: string;
  clientId: string;
  redirectUri: string;
  /** PKCE S256, obligatorio. */
  codeChallenge: string;
  scopes: string[];
  /** RFC 8707: para qué recurso vale el token que salga de aquí. */
  resource: string;
};

export function firmarCodigo(datos: DatosCodigo): Promise<string> {
  return firmar(
    "codigo",
    {
      ced: datos.cedula,
      cid: datos.clientId,
      ru: datos.redirectUri,
      ch: datos.codeChallenge,
      sc: datos.scopes,
      res: datos.resource,
    },
    VIDA.codigo,
  );
}

/**
 * Un código solo se puede canjear una vez, dice la especificación, y sin
 * almacenamiento no se puede tachar el usado. Lo que queda es reducir a nada la
 * ventana: vive 60 segundos y solo sirve con el `code_verifier` de PKCE, que
 * nunca viajó por la red. Quien pueda reusarlo ya tenía que estar dentro del
 * canal del cliente legítimo.
 */
export async function leerCodigo(codigo: string): Promise<DatosCodigo | null> {
  const datos = await verificar("codigo", codigo);
  if (!datos) return null;

  const { ced, cid, ru, ch, sc, res } = datos;
  if (
    typeof ced !== "string" ||
    typeof cid !== "string" ||
    typeof ru !== "string" ||
    typeof ch !== "string" ||
    typeof res !== "string"
  ) {
    return null;
  }

  return {
    cedula: ced,
    clientId: cid,
    redirectUri: ru,
    codeChallenge: ch,
    scopes: Array.isArray(sc) ? (sc as string[]) : [],
    resource: res,
  };
}

/* ------------------------------- Los tokens ------------------------------- */

export type DatosToken = {
  cedula: string;
  clientId: string;
  scopes: string[];
  resource: string;
};

/**
 * El token lleva la cédula, no el nivel de acceso.
 *
 * Meter el nivel aquí lo congelaría hasta que el token venciera: alguien a
 * quien le bajaron el permiso seguiría escribiendo por otra hora. Con la cédula
 * basta para releer la persona de Airtable en cada llamada y usar su nivel de
 * ahora.
 */
export function firmarAcceso(datos: DatosToken): Promise<string> {
  return firmar(
    "acceso",
    { ced: datos.cedula, cid: datos.clientId, sc: datos.scopes, res: datos.resource },
    VIDA.acceso,
  );
}

export function firmarRefresco(datos: DatosToken): Promise<string> {
  return firmar(
    "refresco",
    { ced: datos.cedula, cid: datos.clientId, sc: datos.scopes, res: datos.resource },
    VIDA.refresco,
  );
}

async function leerToken(
  uso: "acceso" | "refresco",
  token: string,
): Promise<DatosToken | null> {
  const datos = await verificar(uso, token);
  if (!datos) return null;

  const { ced, cid, sc, res } = datos;
  if (typeof ced !== "string" || typeof cid !== "string") return null;

  return {
    cedula: ced,
    clientId: cid,
    scopes: Array.isArray(sc) ? (sc as string[]) : [],
    resource: typeof res === "string" ? res : "",
  };
}

export const leerAcceso = (token: string) => leerToken("acceso", token);
export const leerRefresco = (token: string) => leerToken("refresco", token);

/* -------------------------------- Utilidades ------------------------------ */

/**
 * El origen público del CRM según la petición.
 *
 * Detrás del proxy de Vercel, `request.url` trae el host interno; el que el
 * cliente conoce —y el que tiene que aparecer en los metadatos de OAuth, donde
 * cualquier discrepancia rompe el flujo— viene en `x-forwarded-*`.
 */
export function origenDe(request: Request): string {
  const cabeceras = request.headers;
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host");
  if (!host) return new URL(request.url).origin;

  const protocolo =
    cabeceras.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocolo}://${host}`;
}

/** La URL del endpoint MCP, que es el "recurso" en términos de OAuth. */
export function recursoDe(request: Request): string {
  return `${origenDe(request)}/api/mcp`;
}

/** PKCE S256: SHA-256 del verifier en base64url. */
export async function calcularChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return Buffer.from(digest).toString("base64url");
}

/**
 * Si el `redirect_uri` es uno de los que el cliente registró.
 *
 * Comparación exacta, como manda OAuth 2.1: aceptar prefijos es el agujero por
 * el que se filtra un código de autorización a otro sitio.
 */
export function redirectPermitido(
  cliente: ClienteRegistrado,
  redirectUri: string,
): boolean {
  return cliente.redirectUris.includes(redirectUri);
}
