import { json, OPTIONS as preflight } from "@/lib/mcp/cors";
import { origenDe, recursoDe, SCOPES } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { preflight as OPTIONS };

/**
 * Metadatos del servidor de recursos (RFC 9728).
 *
 * Cuando `/api/mcp` responde 401, su cabecera `WWW-Authenticate` apunta aquí, y
 * esto es lo que le dice al cliente quién autoriza. En este CRM el servidor de
 * autorización y el de recursos son el mismo, así que `authorization_servers`
 * apunta a su propio origen.
 *
 * Se sirve en `/.well-known/oauth-protected-resource` y también con el camino
 * del recurso pegado detrás (`.../oauth-protected-resource/api/mcp`), que es la
 * forma que manda el RFC; las dos llegan aquí por rewrite.
 */
export async function GET(request: Request) {
  const origen = origenDe(request);

  return json({
    resource: recursoDe(request),
    authorization_servers: [origen],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "CRM Sirius Regenerative",
  });
}
