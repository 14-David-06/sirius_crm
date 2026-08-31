import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  /**
   * Los descubrimientos de OAuth del conector MCP.
   *
   * Van por rewrite y no como carpetas del App Router porque este no enruta
   * directorios que empiezan por punto, y las dos URLs son fijas por
   * especificación: RFC 8414 para el servidor de autorización y RFC 9728 para
   * el de recursos.
   *
   * La variante con camino detrás (`/.well-known/oauth-protected-resource/api/
   * mcp`) es la forma que manda el RFC 9728 cuando el recurso no está en la
   * raíz; la versión sin camino se conserva porque hay clientes que solo
   * prueban esa.
   */
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth/metadata/autorizacion",
      },
      {
        source: "/.well-known/oauth-authorization-server/:camino*",
        destination: "/api/oauth/metadata/autorizacion",
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/oauth/metadata/recurso",
      },
      {
        source: "/.well-known/oauth-protected-resource/:camino*",
        destination: "/api/oauth/metadata/recurso",
      },
    ];
  },
};

export default nextConfig;
