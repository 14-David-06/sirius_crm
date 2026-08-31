import { json, OPTIONS as preflight } from "@/lib/mcp/cors";
import {
  calcularChallenge,
  firmarAcceso,
  firmarRefresco,
  leerCodigo,
  leerRefresco,
  recursoDe,
  VIDA_ACCESO_SEGUNDOS,
  type DatosToken,
} from "@/lib/mcp/oauth";

export const runtime = "nodejs";

export { preflight as OPTIONS };

/**
 * Canje de código por token, y renovación.
 *
 * No hay autenticación de cliente porque no hay secreto que un cliente MCP
 * pueda guardar: son clientes públicos. Lo que ata el token a quien pidió el
 * código es PKCE, y por eso el `code_verifier` no es opcional aquí.
 */
export async function POST(request: Request) {
  const params = await leerParametros(request);
  if (!params) {
    return error("invalid_request", "No pudimos leer los parámetros.");
  }

  const tipo = params.get("grant_type");

  if (tipo === "authorization_code") {
    return canjearCodigo(request, params);
  }
  if (tipo === "refresh_token") {
    return renovar(request, params);
  }

  return error(
    "unsupported_grant_type",
    "Solo se admiten authorization_code y refresh_token.",
  );
}

async function canjearCodigo(request: Request, params: URLSearchParams) {
  const codigo = params.get("code");
  const verifier = params.get("code_verifier");
  const clientId = params.get("client_id");

  if (!codigo || !verifier || !clientId) {
    return error(
      "invalid_request",
      "Faltan code, code_verifier o client_id.",
    );
  }

  const datos = await leerCodigo(codigo);
  if (!datos) {
    // Vencido (viven 60 segundos), manipulado, o firmado con otro secreto.
    return error("invalid_grant", "El código no es válido o ya expiró.");
  }

  if (datos.clientId !== clientId) {
    return error("invalid_grant", "El código fue emitido para otro cliente.");
  }

  // El `redirect_uri` va en el canje solo para comprobar que es el mismo del
  // paso anterior; si el cliente lo manda, tiene que coincidir.
  const redirectUri = params.get("redirect_uri");
  if (redirectUri && redirectUri !== datos.redirectUri) {
    return error("invalid_grant", "El redirect_uri no coincide con el del código.");
  }

  // PKCE: esto es lo único que demuestra que quien canjea es quien pidió.
  if ((await calcularChallenge(verifier)) !== datos.codeChallenge) {
    return error("invalid_grant", "El code_verifier no corresponde al desafío.");
  }

  return emitir(request, {
    cedula: datos.cedula,
    clientId: datos.clientId,
    scopes: datos.scopes,
    resource: datos.resource,
  });
}

async function renovar(request: Request, params: URLSearchParams) {
  const token = params.get("refresh_token");
  const clientId = params.get("client_id");

  if (!token) {
    return error("invalid_request", "Falta refresh_token.");
  }

  const datos = await leerRefresco(token);
  if (!datos) {
    return error("invalid_grant", "El refresh_token no es válido o ya expiró.");
  }
  if (clientId && datos.clientId !== clientId) {
    return error("invalid_grant", "El refresh_token es de otro cliente.");
  }

  // Renovar no puede ampliar lo concedido: si el cliente pide scopes, tienen
  // que estar dentro de los que la persona autorizó en su momento.
  const pedidos = (params.get("scope") ?? "").split(/\s+/).filter(Boolean);
  const fuera = pedidos.find((scope) => !datos.scopes.includes(scope));
  if (fuera) {
    return error("invalid_scope", `«${fuera}» no estaba entre lo autorizado.`);
  }

  return emitir(request, {
    ...datos,
    scopes: pedidos.length > 0 ? pedidos : datos.scopes,
  });
}

/**
 * Emite el par de tokens.
 *
 * El de refresco se rota en cada uso, como recomienda OAuth 2.1 para clientes
 * públicos: el anterior sigue siendo válido hasta que venza —sin almacén no se
 * puede tachar—, pero al menos el que queda en manos del cliente es siempre el
 * último.
 */
async function emitir(request: Request, datos: DatosToken) {
  const conRecurso = { ...datos, resource: datos.resource || recursoDe(request) };

  const [acceso, refresco] = await Promise.all([
    firmarAcceso(conRecurso),
    firmarRefresco(conRecurso),
  ]);

  return json({
    access_token: acceso,
    token_type: "Bearer",
    expires_in: VIDA_ACCESO_SEGUNDOS,
    refresh_token: refresco,
    scope: conRecurso.scopes.join(" "),
  });
}

/**
 * La especificación pide `application/x-www-form-urlencoded`, pero algún
 * cliente manda JSON; aceptar los dos cuesta cuatro líneas y ahorra un fallo
 * que desde fuera se ve como "el conector no autoriza".
 */
async function leerParametros(
  request: Request,
): Promise<URLSearchParams | null> {
  const tipo = request.headers.get("content-type") ?? "";

  try {
    if (tipo.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      const params = new URLSearchParams();
      for (const [clave, valor] of Object.entries(body)) {
        if (typeof valor === "string") params.set(clave, valor);
      }
      return params;
    }

    return new URLSearchParams(await request.text());
  } catch {
    return null;
  }
}

function error(codigo: string, descripcion: string): Response {
  return json({ error: codigo, error_description: descripcion }, { status: 400 });
}
