/**
 * El puente con el CRM: HTTP contra sus propias rutas de API.
 *
 * No habla con Airtable directamente, y es a propósito. Las reglas del negocio
 * —qué campos son obligatorios, qué estado puede seguir a cuál, quién puede
 * editar qué— viven en `src/lib` y en las rutas de `src/app/api`. Un conector
 * que fuera por su cuenta a Airtable tendría que repetirlas, y el día que una
 * cambiara quedaría escribiendo datos que el CRM ya no acepta.
 *
 * Hay dos formas de conseguir la sesión, y de ahí las dos fábricas de abajo:
 *
 *   - `clienteConLogin` entra con cédula y contraseña. Es la del servidor stdio,
 *     que corre en la máquina de una persona.
 *   - `clienteConCookie` recibe la cookie ya firmada. Es la del endpoint remoto
 *     `/api/mcp`, que ya sabe quién llama porque lo dice el token de OAuth.
 *
 * En los dos casos el nivel de acceso de esa persona es el techo de lo que el
 * conector puede ver y hacer: ninguna herramienta puede nada que ella no pueda
 * entrando al dashboard con el navegador.
 */

const COOKIE = "sirius_session";

export class ErrorCrm extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.name = "ErrorCrm";
    this.status = status;
  }
}

async function cuerpo(respuesta) {
  const texto = await respuesta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return { error: texto.slice(0, 300) };
  }
}

/** Toma la cookie de sesión del `Set-Cookie` del login. */
function extraerCookie(respuesta) {
  const cookies = respuesta.headers.getSetCookie?.() ?? [];
  for (const cruda of cookies) {
    const [par] = cruda.split(";");
    const [nombre, ...resto] = par.split("=");
    if (nombre.trim() === COOKIE) return resto.join("=").trim();
  }
  return null;
}

/**
 * Lo común a las dos fábricas: llamar al CRM con una cookie y, si la cookie ya
 * no vale, dejar que quien la consiguió la renueve y reintentar una sola vez.
 * Un segundo 401 ya es un problema de credenciales, no de vencimiento.
 */
function armar(url, conseguirCookie) {
  const base = url.replace(/\/+$/, "");
  let cookie = null;

  async function pedir(metodo, ruta, datos, reintentar = true) {
    cookie ??= await conseguirCookie();

    const respuesta = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: {
        cookie: `${COOKIE}=${cookie}`,
        ...(datos === undefined ? {} : { "content-type": "application/json" }),
      },
      body: datos === undefined ? undefined : JSON.stringify(datos),
      redirect: "manual",
    });

    if (respuesta.status === 401 && reintentar) {
      cookie = null;
      return pedir(metodo, ruta, datos, false);
    }

    const contenido = await cuerpo(respuesta);

    if (!respuesta.ok) {
      // El CRM explica cada rechazo en español y con el motivo real; ese
      // mensaje es más útil para quien lo lea que cualquier cosa de aquí.
      throw new ErrorCrm(
        contenido?.error ?? `El CRM respondió HTTP ${respuesta.status}.`,
        respuesta.status,
      );
    }

    return contenido ?? {};
  }

  return {
    url: base,
    pedir,
    obtener: (ruta) => pedir("GET", ruta, undefined),
    crear: (ruta, datos) => pedir("POST", ruta, datos),
    modificar: (ruta, datos) => pedir("PATCH", ruta, datos),
  };
}

/**
 * Cliente que se autentica con cédula y contraseña.
 *
 * La cookie vive en memoria del proceso, que muere con Claude. El JWT dura 8
 * horas y el conector puede llevar días arriba, así que la renovación por 401
 * de `armar` es el caso normal, no el excepcional.
 *
 * `credenciales` es una función y no dos strings para que la falta de una
 * variable de entorno estalle en la primera llamada a una herramienta —donde
 * Claude puede leer el mensaje y decirlo— y no al arrancar el proceso, donde
 * solo queda un servidor muerto en el log.
 */
export function clienteConLogin({ url, credenciales }) {
  return armar(url, async () => {
    const { cedula, password } = credenciales();
    const base = url.replace(/\/+$/, "");
    const respuesta = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cedula, password }),
      redirect: "manual",
    });

    const datos = await cuerpo(respuesta);

    if (!respuesta.ok) {
      throw new ErrorCrm(
        `No pudimos iniciar sesión en el CRM (${base}): ${
          datos?.error ?? `HTTP ${respuesta.status}`
        }`,
        respuesta.status,
      );
    }

    const cookie = extraerCookie(respuesta);
    if (!cookie) {
      throw new ErrorCrm(
        "El CRM aceptó el login pero no devolvió cookie de sesión.",
        502,
      );
    }
    return cookie;
  });
}

/**
 * Cliente que ya tiene la sesión firmada.
 *
 * Lo usa `/api/mcp`: el token de OAuth ya dice quién llama, así que firma una
 * cookie de sesión para esa persona y la pasa aquí. Un 401 en este cliente no
 * se puede recuperar renovando —no hay contraseña que reintentar—, y por eso
 * `conseguirCookie` devuelve siempre la misma: el segundo intento falla con el
 * mensaje del CRM, que es lo correcto.
 */
export function clienteConCookie({ url, cookie }) {
  return armar(url, () => cookie);
}
