#!/usr/bin/env node
/**
 * Prueba de punta a punta del flujo OAuth del conector remoto.
 *
 * Recorre lo que hace claude.ai al agregar el conector —registro dinámico,
 * autorización, canje de código con PKCE, renovación, llamada al endpoint MCP—
 * y además los caminos que tienen que fallar: un `redirect_uri` que no se
 * registró, PKCE ausente o equivocado, un token de otro recurso, un token
 * firmado con otra clave.
 *
 * El único paso que no cubre es la comprobación de la contraseña, porque haría
 * falta una credencial real de Airtable; para eso está la pantalla. Lo que sí
 * hace es firmar el código de autorización con la misma clave derivada que
 * usaría esa pantalla, de modo que todo lo que viene después del login sí queda
 * probado. Por eso necesita el `.env.local` con `SESSION_SECRET`.
 *
 *   npm run dev                       (en otra terminal)
 *   npm run mcp:probar-oauth          (contra http://localhost:3000)
 *   node mcp/probar-oauth.mjs https://crm.ejemplo.com
 *
 * Contra producción los pasos que emiten tokens quedan en el aire salvo que la
 * máquina tenga el mismo SESSION_SECRET; el resto de comprobaciones sirve igual.
 */

import { readFileSync } from "node:fs";
import { hkdfSync, randomBytes, createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const B = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");

const SALTO = /\r?\n/;

const env = Object.fromEntries(
  readFileSync(resolve(RAIZ, ".env.local"), "utf8")
    .split(SALTO)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    }),
);

const clave = (uso) =>
  new Uint8Array(
    hkdfSync("sha256", env.SESSION_SECRET, "sirius-mcp-oauth", uso, 32),
  );

function ok(etiqueta, condicion, extra = "") {
  console.log(
    `${condicion ? "PASA " : "FALLA"}  ${etiqueta}${extra ? " — " + extra : ""}`,
  );
  if (!condicion) process.exitCode = 1;
}

console.log(`
Flujo OAuth contra ${B}
`);

/* 1. Registro dinámico */
const reg = await fetch(`${B}/api/oauth/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    client_name: "Claude",
    redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
  }),
});
const cliente = await reg.json();
ok("register devuelve client_id", reg.status === 201 && !!cliente.client_id);

/* 2. redirect_uri no registrado → error fatal, sin redirigir */
const malo = await fetch(
  `${B}/api/oauth/authorize?response_type=code&client_id=${encodeURIComponent(cliente.client_id)}&redirect_uri=https://evil.example/cb&code_challenge=x&code_challenge_method=S256`,
  { redirect: "manual" },
);
ok("redirect_uri ajeno se rechaza en pantalla", malo.status === 400, `HTTP ${malo.status}`);

/* 3. Solicitud válida → 302 a /autorizar */
const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const redirectUri = "https://claude.ai/api/mcp/auth_callback";

const bueno = await fetch(
  `${B}/api/oauth/authorize?response_type=code&client_id=${encodeURIComponent(cliente.client_id)}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&state=abc123`,
  { redirect: "manual" },
);
const destino = bueno.headers.get("location") ?? "";
ok("solicitud válida va a /autorizar", bueno.status === 302 && destino.includes("/autorizar"), destino.slice(0, 70));

/* 4. PKCE sin S256 → error al redirect_uri del cliente */
const sinPkce = await fetch(
  `${B}/api/oauth/authorize?response_type=code&client_id=${encodeURIComponent(cliente.client_id)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
  { redirect: "manual" },
);
const errPkce = sinPkce.headers.get("location") ?? "";
ok("sin code_challenge se reporta al cliente", errPkce.includes("error=invalid_request"), errPkce.slice(0, 90));

/* 5. Código inválido en el token endpoint */
const mal = await fetch(`${B}/api/oauth/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: "no-es-un-codigo",
    code_verifier: verifier,
    client_id: cliente.client_id,
  }),
});
const malJson = await mal.json();
ok("código falso → invalid_grant", mal.status === 400 && malJson.error === "invalid_grant");

/**
 * 6. Flujo completo. El código se firma aquí con la misma clave derivada que
 *    usaría la pantalla de autorización: es lo que permite probar el canje y el
 *    endpoint MCP sin una contraseña real de Airtable.
 */
// Una cédula que no existe: el flujo tiene que llegar hasta aquí y parar
// justo en la comprobación de identidad contra Airtable.
const CEDULA_INEXISTENTE = "10000000001";
const codigo = await new SignJWT({
  uso: "codigo",
  ced: CEDULA_INEXISTENTE,
  cid: cliente.client_id,
  ru: redirectUri,
  ch: challenge,
  sc: ["crm.leer", "crm.escribir"],
  res: `${B}/api/mcp`,
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("60s")
  .sign(clave("codigo"));

/* 6a. Verifier equivocado */
const pkceMal = await fetch(`${B}/api/oauth/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: codigo,
    code_verifier: randomBytes(32).toString("base64url"),
    client_id: cliente.client_id,
  }),
});
const pkceMalJson = await pkceMal.json();
ok("verifier equivocado se rechaza", pkceMal.status === 400 && pkceMalJson.error === "invalid_grant", pkceMalJson.error_description);

/* 6b. Canje correcto */
const canje = await fetch(`${B}/api/oauth/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: codigo,
    code_verifier: verifier,
    client_id: cliente.client_id,
    redirect_uri: redirectUri,
  }),
});
const tokens = await canje.json();
ok("canje devuelve access_token y refresh_token",
   canje.status === 200 && !!tokens.access_token && !!tokens.refresh_token,
   `scope=${tokens.scope} expires_in=${tokens.expires_in}`);

/* 6c. Renovación */
const renov = await fetch(`${B}/api/oauth/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: cliente.client_id,
  }),
});
const renovJson = await renov.json();
ok("refresh_token renueva", renov.status === 200 && !!renovJson.access_token);

/* 6d. Ampliar scopes al renovar no se permite */
const amplia = await fetch(`${B}/api/oauth/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: cliente.client_id,
    scope: "crm.admin",
  }),
});
ok("no se puede ampliar scope al renovar", (await amplia.json()).error === "invalid_scope");

/* 7. /api/mcp con token válido: llega hasta la comprobación de identidad */
const mcp = await fetch(`${B}/api/mcp`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    authorization: `Bearer ${tokens.access_token}`,
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "prueba", version: "1" } },
  }),
});
const mcpJson = await mcp.json().catch(() => ({}));
const mensaje = mcpJson?.error?.message ?? JSON.stringify(mcpJson).slice(0, 120);
ok("token firmado se acepta y la identidad se relee de Airtable",
   mcp.status === 401 && /no está activo/.test(mensaje),
   mensaje);

/* 8. Token con recurso ajeno */
const otroRecurso = await new SignJWT({
  uso: "acceso",
  ced: CEDULA_INEXISTENTE,
  cid: cliente.client_id,
  sc: ["crm.leer"],
  res: "https://otro.example/api/mcp",
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("60s")
  .sign(clave("acceso"));

const ajeno = await fetch(`${B}/api/mcp`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${otroRecurso}` },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
});
ok("token de otro recurso se rechaza", ajeno.status === 401,
   (await ajeno.json())?.error?.message);

/* 9. Un token firmado con otra clave no pasa */
const falso = await new SignJWT({ uso: "acceso", ced: "1", cid: "x", sc: [] })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("60s")
  .sign(new Uint8Array(32));

const conFalso = await fetch(`${B}/api/mcp`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${falso}` },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
});
ok("token con firma ajena se rechaza", conFalso.status === 401);
