import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { findPersonaByCedula } from "@/lib/airtable";
import { conCors, OPTIONS as preflight } from "@/lib/mcp/cors";
import {
  leerAcceso,
  origenDe,
  recursoDe,
  SCOPE_ESCRIBIR,
} from "@/lib/mcp/oauth";
import { signSession, type SessionPayload } from "@/lib/session";
import { clienteConCookie } from "@mcp/cliente-crm.mjs";
import { construirServidor } from "@mcp/servidor-comun.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { preflight as OPTIONS };

/**
 * El conector MCP remoto: las mismas 19 herramientas del servidor stdio, pero
 * servidas por HTTP para que el equipo lo agregue en claude.ai y funcione desde
 * el celular sin instalar nada.
 *
 * ## Quién es quien llama
 *
 * El token de OAuth trae la cédula de la persona que autorizó. Con ella se
 * relee su ficha de Airtable *en cada petición* —no se confía en lo que diga el
 * token sobre su nivel— y se firma una cookie de sesión igual a la que emitiría
 * el login. Las herramientas usan esa cookie contra las mismas rutas de
 * `/api/*` que usa el dashboard.
 *
 * Dar la vuelta por HTTP en lugar de llamar a `src/lib` directamente es
 * deliberado: las validaciones y los permisos de este CRM viven en las rutas, y
 * `getSession()` lee la cookie de la petición entrante, no de una que se le
 * pase. Un camino "interno" tendría que reimplementar esos controles y podría
 * quedarse atrás del que sí se revisa. Así el conector es un cliente más de la
 * misma API pública, sin atajos.
 *
 * ## Sin estado
 *
 * Sin sesión de transporte: cada petición arma su servidor y lo cierra. En
 * Vercel dos peticiones seguidas caen en lambdas distintas, así que una sesión
 * en memoria se perdería a la segunda llamada.
 */

type Identidad = {
  session: SessionPayload;
  puedeEscribir: boolean;
};

/**
 * Un 401 que le dice al cliente dónde autenticarse.
 *
 * La cabecera `WWW-Authenticate` con `resource_metadata` (RFC 9728) es lo que
 * arranca todo el flujo: sin ella el cliente solo ve un 401 y no sabe que hay
 * un servidor de autorización detrás.
 */
function noAutorizado(request: Request, detalle: string): Response {
  const metadatos = `${origenDe(request)}/.well-known/oauth-protected-resource/api/mcp`;

  return conCors(
    Response.json(
      {
        jsonrpc: "2.0",
        error: { code: -32001, message: detalle },
        id: null,
      },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer resource_metadata="${metadatos}", error="invalid_token", error_description="${detalle}"`,
        },
      },
    ),
  );
}

async function autenticar(
  request: Request,
): Promise<Identidad | { error: Response }> {
  const cabecera = request.headers.get("authorization") ?? "";
  const [esquema, token] = cabecera.split(" ");

  if (esquema?.toLowerCase() !== "bearer" || !token) {
    return { error: noAutorizado(request, "Falta el token de acceso.") };
  }

  const datos = await leerAcceso(token);
  if (!datos) {
    return {
      error: noAutorizado(request, "El token no es válido o ya expiró."),
    };
  }

  // RFC 8707: un token emitido para otro recurso no vale aquí, aunque lo haya
  // firmado este mismo servidor.
  const recurso = recursoDe(request);
  if (datos.resource && datos.resource !== recurso) {
    return {
      error: noAutorizado(request, "El token fue emitido para otro recurso."),
    };
  }

  let persona;
  try {
    persona = await findPersonaByCedula(datos.cedula);
  } catch (error) {
    console.error("mcp identidad", error);
    return {
      error: conCors(
        Response.json(
          { error: "No pudimos verificar tu usuario en este momento." },
          { status: 502 },
        ),
      ),
    };
  }

  // Aquí está la revocación real: inactivar a la persona en Sirius Nomina Core
  // corta el conector en la siguiente llamada, sin tocar ningún token.
  if (!persona || !persona.activo) {
    return {
      error: noAutorizado(
        request,
        "Tu usuario ya no está activo en el sistema.",
      ),
    };
  }

  return {
    session: {
      sub: persona.recordId,
      cedula: persona.cedula,
      nombre: persona.nombre,
      idEmpleado: persona.idEmpleado,
      rol: persona.rol,
      // El nivel sale de Airtable ahora, no de lo que dijera el token: si se lo
      // bajaron esta mañana, el conector ya no puede lo que podía ayer.
      nivelAcceso: persona.nivelAcceso,
    },
    puedeEscribir: datos.scopes.includes(SCOPE_ESCRIBIR),
  };
}

async function atender(request: Request): Promise<Response> {
  const identidad = await autenticar(request);
  if ("error" in identidad) return identidad.error;

  const api = clienteConCookie({
    url: origenDe(request),
    cookie: await signSession(identidad.session),
  });

  const servidor = construirServidor({
    api,
    // Sin el scope de escritura las herramientas que escriben ni se anuncian:
    // es más claro que ofrecerlas y fallar con un 403 al usarlas.
    soloLectura: !identidad.puedeEscribir,
  });

  const transporte = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    // JSON en vez de SSE: la respuesta sale completa y la función termina, que
    // es lo que quiere una lambda. Un stream abierto solo suma tiempo de
    // ejecución sin que estas herramientas lo aprovechen.
    enableJsonResponse: true,
  });

  try {
    await servidor.connect(transporte);
    const respuesta = await transporte.handleRequest(request);

    // El cuerpo se copia antes de cerrar: `close()` con el stream a medio leer
    // dejaría la respuesta truncada.
    const cuerpo = await respuesta.arrayBuffer();

    return conCors(
      new Response(cuerpo, {
        status: respuesta.status,
        headers: respuesta.headers,
      }),
    );
  } finally {
    await transporte.close().catch(() => {});
    await servidor.close().catch(() => {});
  }
}

export const POST = atender;
export const GET = atender;
export const DELETE = atender;
