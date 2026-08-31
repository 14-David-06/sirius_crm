import { json, OPTIONS as preflight } from "@/lib/mcp/cors";
import { registrarCliente, SCOPES } from "@/lib/mcp/oauth";

export const runtime = "nodejs";

export { preflight as OPTIONS };

/**
 * Registro dinámico de clientes (RFC 7591).
 *
 * claude.ai no está dado de alta en ninguna parte: al agregar el conector se
 * registra solo con esta llamada y recibe un `client_id`. Es lo que hace que
 * baste con pegar la URL del endpoint.
 *
 * El `client_id` que devuelve *es* el registro firmado, así que no se guarda
 * nada. Un registro no autoriza a nada por sí mismo —autoriza la persona,
 * después, en pantalla— así que el endpoint puede estar abierto: lo único que
 * consigue quien lo llame es un identificador para pedirle permiso a alguien.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return json(
      { error: "invalid_client_metadata", error_description: "Cuerpo inválido." },
      { status: 400 },
    );
  }

  const uris = leerUris(body.redirect_uris);
  if (uris === null) {
    return json(
      {
        error: "invalid_redirect_uri",
        error_description:
          "redirect_uris tiene que ser una lista de URLs absolutas https (o http en localhost).",
      },
      { status: 400 },
    );
  }

  const nombre =
    typeof body.client_name === "string" ? body.client_name.slice(0, 120) : null;

  const clientId = await registrarCliente({ redirectUris: uris, nombre });

  return json(
    {
      client_id: clientId,
      client_name: nombre,
      redirect_uris: uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPES.join(" "),
      // Sin expiración: el registro vive dentro del propio client_id.
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201 },
  );
}

/**
 * Valida las URLs de retorno. Solo `https`, salvo en localhost, que es donde
 * corren los clientes de escritorio durante el flujo. Devuelve null si alguna
 * no sirve: media URL válida no es una lista válida.
 */
function leerUris(valor: unknown): string[] | null {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > 10) {
    return null;
  }

  const uris: string[] = [];
  for (const crudo of valor) {
    if (typeof crudo !== "string") return null;

    let url: URL;
    try {
      url = new URL(crudo);
    } catch {
      return null;
    }

    const esLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && esLocal)) {
      return null;
    }
    // Un fragmento en el redirect_uri no está permitido y rompe la comparación
    // exacta que se hace al autorizar.
    if (url.hash) return null;

    uris.push(crudo);
  }

  return uris;
}
