import bcrypt from "bcryptjs";

import { findPersonaByCedula } from "@/lib/airtable";
import { json, OPTIONS as preflight } from "@/lib/mcp/cors";
import {
  firmarCodigo,
  leerCliente,
  origenDe,
  recursoDe,
  redirectPermitido,
  SCOPE_ESCRIBIR,
  SCOPE_LEER,
  type ClienteRegistrado,
} from "@/lib/mcp/oauth";
import { excedeIntentos, ipDe, olvidarIntentos } from "@/lib/rate-limit";
import { normalizeCedula } from "@/lib/validation";

export const runtime = "nodejs";

export { preflight as OPTIONS };

/**
 * El endpoint de autorización de OAuth.
 *
 * `GET` valida la solicitud del cliente y manda a la persona a la pantalla de
 * autorización. `POST` es lo que envía esa pantalla: cédula, contraseña y si
 * concede permiso de escritura. De ahí sale el código de autorización.
 *
 * La contraseña se comprueba aquí y no se reutiliza la ruta de login normal a
 * propósito: autorizar un conector no debe dejar una sesión del dashboard
 * abierta en el navegador. Lo único que produce este paso es el código.
 */

type Solicitud = {
  cliente: ClienteRegistrado;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  scopes: string[];
  resource: string;
};

/** Un problema que no se puede reportar por redirect: hay que mostrarlo. */
type ErrorFatal = { fatal: string };

/** Un problema que sí se reporta al cliente en su propio redirect_uri. */
type ErrorRedirigible = {
  redirectUri: string;
  error: string;
  descripcion: string;
  state: string | null;
};

function esFatal(valor: unknown): valor is ErrorFatal {
  return typeof valor === "object" && valor !== null && "fatal" in valor;
}

function esRedirigible(valor: unknown): valor is ErrorRedirigible {
  return typeof valor === "object" && valor !== null && "error" in valor;
}

/**
 * Valida la solicitud, y la valida igual en los dos verbos.
 *
 * El orden importa: hasta que el `redirect_uri` no está confirmado contra el
 * registro del cliente, ningún error puede irse por redirect — mandar un
 * `error=` a una URL no verificada es lo mismo que mandarle el código, en
 * cuanto a decirle a un tercero que existe algo aquí. Por eso los dos primeros
 * problemas son fatales y se muestran en pantalla.
 */
async function validarSolicitud(
  request: Request,
  params: URLSearchParams,
): Promise<Solicitud | ErrorFatal | ErrorRedirigible> {
  const clientId = params.get("client_id");
  if (!clientId) {
    return { fatal: "Falta client_id en la solicitud." };
  }

  const cliente = await leerCliente(clientId);
  if (!cliente) {
    return {
      fatal:
        "El client_id no es válido o fue emitido con otro secreto de sesión. " +
        "Quita el conector y agrégalo de nuevo para que se registre otra vez.",
    };
  }

  const redirectUri = params.get("redirect_uri");
  if (!redirectUri || !redirectPermitido(cliente, redirectUri)) {
    return {
      fatal:
        "El redirect_uri no coincide con ninguno de los que registró este cliente.",
    };
  }

  // Desde aquí el redirect_uri está verificado y los errores ya pueden viajar.
  const state = params.get("state");
  const problema = (error: string, descripcion: string): ErrorRedirigible => ({
    redirectUri,
    error,
    descripcion,
    state,
  });

  if (params.get("response_type") !== "code") {
    return problema(
      "unsupported_response_type",
      "Solo se admite response_type=code.",
    );
  }

  const codeChallenge = params.get("code_challenge");
  if (!codeChallenge) {
    return problema("invalid_request", "PKCE es obligatorio: falta code_challenge.");
  }
  if (params.get("code_challenge_method") !== "S256") {
    return problema(
      "invalid_request",
      "El único code_challenge_method admitido es S256.",
    );
  }

  // RFC 8707. Si el cliente dice para qué recurso quiere el token, tiene que
  // ser este; si no lo dice, se asume este y el token queda igual de atado.
  const recurso = recursoDe(request);
  const pedido = params.get("resource");
  if (pedido && pedido.replace(/\/+$/, "") !== recurso) {
    return problema(
      "invalid_target",
      `Este servidor solo emite tokens para ${recurso}.`,
    );
  }

  // Leer siempre se concede; escribir solo si la persona lo marca al autorizar,
  // así que aquí se guarda lo que el cliente *pidió* y la pantalla decide.
  const pedidos = (params.get("scope") ?? "").split(/\s+/).filter(Boolean);
  const desconocido = pedidos.find(
    (scope) => scope !== SCOPE_LEER && scope !== SCOPE_ESCRIBIR,
  );
  if (desconocido) {
    return problema("invalid_scope", `El scope «${desconocido}» no existe.`);
  }

  return {
    cliente,
    clientId,
    redirectUri,
    codeChallenge,
    state,
    scopes: pedidos.length > 0 ? pedidos : [SCOPE_LEER, SCOPE_ESCRIBIR],
    resource: recurso,
  };
}

function redirigirConError(problema: ErrorRedirigible): Response {
  const destino = new URL(problema.redirectUri);
  destino.searchParams.set("error", problema.error);
  destino.searchParams.set("error_description", problema.descripcion);
  if (problema.state) destino.searchParams.set("state", problema.state);

  return Response.redirect(destino.toString(), 302);
}

/** Manda a la pantalla de autorización, ya validada la solicitud. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const solicitud = await validarSolicitud(request, params);

  if (esFatal(solicitud)) {
    return new Response(paginaDeError(solicitud.fatal), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  if (esRedirigible(solicitud)) {
    return redirigirConError(solicitud);
  }

  // La pantalla recibe los mismos parámetros y los devuelve al POST, que los
  // vuelve a validar: nada de lo que pase por el navegador se da por bueno.
  const destino = new URL("/autorizar", origenDe(request));
  for (const clave of [
    "client_id",
    "redirect_uri",
    "code_challenge",
    "code_challenge_method",
    "response_type",
    "state",
    "scope",
    "resource",
  ]) {
    const valor = params.get(clave);
    if (valor) destino.searchParams.set(clave, valor);
  }

  return Response.redirect(destino.toString(), 302);
}

/**
 * Lo que envía la pantalla de autorización: quién es y qué concede.
 *
 * Devuelve la URL de retorno en JSON en vez de redirigir, para que la pantalla
 * pueda mostrar el error de contraseña sin recargar y perder el formulario.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const params = new URLSearchParams();
  for (const clave of [
    "client_id",
    "redirect_uri",
    "code_challenge",
    "code_challenge_method",
    "response_type",
    "state",
    "scope",
    "resource",
  ]) {
    const valor = body[clave];
    if (typeof valor === "string") params.set(clave, valor);
  }

  const solicitud = await validarSolicitud(request, params);
  if (esFatal(solicitud)) {
    return json({ error: solicitud.fatal }, { status: 400 });
  }
  if (esRedirigible(solicitud)) {
    return json(
      { error: solicitud.descripcion, redirect: null },
      { status: 400 },
    );
  }

  const cedula = normalizeCedula(body.cedula ?? null);
  const password = typeof body.password === "string" ? body.password : "";

  if (!cedula || !password) {
    return json({ error: "Ingresa tu cédula y contraseña." }, { status: 400 });
  }

  // El mismo límite que el login: este endpoint también prueba contraseñas.
  if (await excedeIntentos("oauth", cedula, ipDe(request))) {
    return json(
      { error: "Demasiados intentos fallidos. Espera unos minutos." },
      { status: 429 },
    );
  }

  let persona;
  try {
    persona = await findPersonaByCedula(cedula);
  } catch (error) {
    console.error("oauth authorize", error);
    return json(
      { error: "No pudimos validar tus datos. Intenta de nuevo." },
      { status: 502 },
    );
  }

  if (!persona || !persona.activo || !persona.passwordHash) {
    // Un mensaje único: distinguir "no existe" de "no tiene contraseña" aquí
    // convierte esta pantalla en un padrón consultable.
    return json({ error: "Cédula o contraseña incorrecta." }, { status: 401 });
  }

  if (!(await bcrypt.compare(password, persona.passwordHash))) {
    return json({ error: "Cédula o contraseña incorrecta." }, { status: 401 });
  }

  await olvidarIntentos("oauth", cedula);

  // Escribir solo si la persona lo concedió *y* el cliente lo pidió.
  const escribir =
    body.escribir === true && solicitud.scopes.includes(SCOPE_ESCRIBIR);
  const concedidos = escribir ? [SCOPE_LEER, SCOPE_ESCRIBIR] : [SCOPE_LEER];

  const codigo = await firmarCodigo({
    cedula: persona.cedula,
    clientId: solicitud.clientId,
    redirectUri: solicitud.redirectUri,
    codeChallenge: solicitud.codeChallenge,
    scopes: concedidos,
    resource: solicitud.resource,
  });

  const destino = new URL(solicitud.redirectUri);
  destino.searchParams.set("code", codigo);
  if (solicitud.state) destino.searchParams.set("state", solicitud.state);
  // `iss` deja al cliente confirmar quién emitió el código (OAuth 2.1).
  destino.searchParams.set("iss", origenDe(request));

  return json({ redirect: destino.toString() });
}

/**
 * Los errores fatales se muestran, no se redirigen, así que hacen falta unas
 * líneas de HTML. Es la única pantalla del flujo que no puede ser una página de
 * React: en este punto no se confía en el `redirect_uri` y la solicitud ni
 * siquiera llega a `/autorizar`.
 */
function paginaDeError(mensaje: string): string {
  const escapado = mensaje.replace(
    /[&<>"']/g,
    (caracter) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[caracter] ?? caracter,
  );

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>No pudimos autorizar el conector</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #fafafa; color: #111;
         font: 15px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 34rem; padding: 2rem; }
  h1 { font-size: 1.15rem; margin: 0 0 .75rem; }
  p { margin: 0; color: #444; }
  @media (prefers-color-scheme: dark) {
    body { background: #0b0b0b; color: #f4f4f4; } p { color: #b4b4b4; }
  }
</style>
</head>
<body><main>
<h1>No pudimos autorizar el conector</h1>
<p>${escapado}</p>
</main></body>
</html>`;
}
