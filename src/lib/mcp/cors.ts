/**
 * CORS para los endpoints del conector remoto.
 *
 * claude.ai llama a `/api/mcp` y a los metadatos de OAuth desde el navegador,
 * es decir desde otro origen. Sin estas cabeceras el navegador descarta la
 * respuesta antes de que nadie la lea, y el síntoma es un conector que "no
 * conecta" sin ningún error en los logs del servidor.
 *
 * `*` y sin credenciales a propósito: la autorización de estos endpoints va en
 * la cabecera `Authorization`, nunca en cookies, así que no hay nada que un
 * sitio de terceros pueda disparar en nombre de quien esté logueado. Abrirlo a
 * cookies sí sería un agujero.
 */

const CABECERAS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  // `WWW-Authenticate` es la que le dice al cliente dónde autenticarse; si el
  // navegador no la expone, el flujo de OAuth nunca arranca.
  "Access-Control-Expose-Headers":
    "Mcp-Session-Id, Mcp-Protocol-Version, WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
} as const;

/** Agrega las cabeceras de CORS a una respuesta ya armada. */
export function conCors(respuesta: Response): Response {
  const cabeceras = new Headers(respuesta.headers);
  for (const [nombre, valor] of Object.entries(CABECERAS)) {
    cabeceras.set(nombre, valor);
  }

  return new Response(respuesta.body, {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: cabeceras,
  });
}

/** Respuesta al preflight. */
export function OPTIONS(): Response {
  return conCors(new Response(null, { status: 204 }));
}

/** JSON con CORS, que es lo que devuelven casi todas estas rutas. */
export function json(datos: unknown, init?: ResponseInit): Response {
  return conCors(
    Response.json(datos, {
      ...init,
      headers: {
        // Los metadatos de OAuth y los errores no se cachean: el origen puede
        // cambiar entre despliegues y un error cacheado es un conector muerto.
        "Cache-Control": "no-store",
        ...init?.headers,
      },
    }),
  );
}
