import { json, OPTIONS as preflight } from "@/lib/mcp/cors";
import { origenDe, SCOPES } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { preflight as OPTIONS };

/**
 * Metadatos del servidor de autorización (RFC 8414).
 *
 * Se sirve en `/.well-known/oauth-authorization-server` por un rewrite de
 * `next.config.ts`: el App Router no enruta carpetas que empiezan por punto.
 *
 * Es lo primero que lee claude.ai al agregar el conector, y de aquí saca las
 * tres URLs del flujo. Todo se calcula desde el origen de la petición y no de
 * una variable de entorno, porque cualquier diferencia entre lo que se anuncia
 * aquí y la URL real hace fallar la validación del cliente — y con dominios de
 * previsualización de Vercel esa diferencia es la norma.
 */
export async function GET(request: Request) {
  const origen = origenDe(request);

  return json({
    issuer: origen,
    authorization_endpoint: `${origen}/api/oauth/authorize`,
    token_endpoint: `${origen}/api/oauth/token`,
    registration_endpoint: `${origen}/api/oauth/register`,
    scopes_supported: [...SCOPES],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    // PKCE obligatorio y solo S256: `plain` no protege de nada.
    code_challenge_methods_supported: ["S256"],
    // Clientes públicos: no hay secreto que un cliente MCP pueda guardar.
    token_endpoint_auth_methods_supported: ["none"],
    // RFC 8707: el token queda atado al endpoint MCP y no vale para otra cosa.
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${origen}/api/mcp`,
  });
}
