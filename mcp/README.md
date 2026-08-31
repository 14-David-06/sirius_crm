# Conector MCP del CRM

Deja hablar a Claude con este CRM: consultar clientes, visitas, casos, pedidos y
catálogo, y también registrar visitas, abrir casos PQRSF, crear pedidos y mover
estados.

Hay **dos formas de conectarse a las mismas 16 herramientas**:

| | Remoto (`/api/mcp`) | Local (stdio) |
| --- | --- | --- |
| Para quién | El equipo | Desarrollo |
| Desde dónde | claude.ai, el celular, Claude Desktop, Claude Code | La máquina donde está el repo |
| Instalación | Ninguna: se pega una URL | Node + repo + `.env.local` |
| Quién eres | Cada persona entra con SU cédula (OAuth) | La cédula del `.env.local` |
| Cuándo usarlo | Producción | Probar cambios contra `localhost` sin pasar por OAuth |

## Cómo está armado

Las herramientas están definidas una sola vez (`herramientas-lectura.mjs` y
`herramientas-escritura.mjs`) y reciben inyectado el cliente del CRM, así que
cambiar de transporte no cambia lo que Claude puede hacer.

En los dos casos el conector **habla con el CRM por su propia API HTTP**, no con
Airtable. Eso es lo que hace que no haya una segunda copia de las reglas del
negocio: las validaciones (`revisarVisita`, los estados que puede seguir un
pedido, la solución obligatoria al cerrar un caso) y los permisos (`permisosDe`,
`puedeEditar`) siguen siendo los de `src/`, y el conector los hereda enteros.

```
claude.ai ──HTTPS+OAuth──> /api/mcp ──┐
                                      ├──> /api/* ──> src/lib ──> Airtable
Claude Code ──stdio──> servidor.mjs ──┘
```

Y sobre todo: **nadie gana permisos por usar el conector**. La sesión que se usa
es la de una persona real del CRM, así que su nivel de acceso es el techo. Un
usuario de nivel «Lectura» no puede escribir a través de Claude, y uno sin
alcance de equipo solo ve lo suyo.

---

## Remoto: para el equipo, en producción

### 1. Desplegar

`git push`. No hay ninguna variable de entorno nueva que configurar: las claves
de OAuth se derivan del `SESSION_SECRET` que el CRM ya tiene, con HKDF y una
etiqueta distinta por uso.

### 2. Comprobar que quedó bien publicado

```
node mcp/probar-oauth.mjs https://tu-dominio
```

Recorre el flujo completo y también los caminos que tienen que fallar. Los pasos
que emiten tokens necesitan que la máquina tenga el mismo `SESSION_SECRET`; el
resto sirve igual desde cualquier parte.

A mano, lo mínimo que tiene que responder:

```
curl https://tu-dominio/.well-known/oauth-authorization-server
curl -i -X POST https://tu-dominio/api/mcp     # 401 + WWW-Authenticate
```

### 3. Agregarlo en claude.ai

Configuración → Conectores → Agregar conector personalizado, y pegar:

```
https://tu-dominio/api/mcp
```

Claude se registra solo (RFC 7591), abre la pantalla de autorización del CRM, y
cada persona entra ahí con **su** cédula y contraseña. En esa pantalla decide
además si concede permiso de escritura o solo de consulta.

### Qué pasa por debajo

1. Claude pide `/api/mcp` sin token y recibe un **401** con `WWW-Authenticate`
   apuntando a `/.well-known/oauth-protected-resource/api/mcp`.
2. De ahí llega a `/.well-known/oauth-authorization-server` y se **registra**
   en `/api/oauth/register`.
3. Manda a la persona a `/api/oauth/authorize`, que valida la solicitud y la
   lleva a la pantalla `/autorizar`.
4. La persona entra con su cédula. Sale un **código** de 60 segundos.
5. Claude lo **canjea** en `/api/oauth/token` con PKCE y recibe un token de
   acceso (1 hora) y uno de refresco (30 días).
6. Cada llamada a `/api/mcp` **relee la persona de Airtable** con la cédula del
   token, firma una cookie de sesión y usa las mismas rutas de `/api/*`.

### Revocación

El paso 6 es la parte importante: el token no lleva el nivel de acceso, solo la
cédula. Por eso:

- **Inactivar a la persona** en Sirius Nomina Core corta el conector en la
  siguiente llamada.
- **Bajarle el nivel** se refleja igual de rápido, sin tocar ningún token.
- **Quitar el conector** en Claude borra los tokens del lado del cliente.
- **Rotar `SESSION_SECRET`** invalida todos los tokens de golpe — y también
  todas las sesiones abiertas del dashboard.

Lo que **no** hay es revocar un token suelto: no se guardan en ninguna parte,
van firmados. Es el precio de no montar una base de datos solo para esto, y por
eso el token de acceso dura una hora y no un mes.

### Detalles de despliegue que conviene saber

- **Los `.well-known` van por rewrite** en `next.config.ts`: el App Router no
  enruta carpetas que empiezan por punto. Si algún día se tocan las rutas de
  OAuth, hay que tocar también esos rewrites.
- **El origen se calcula de `x-forwarded-host`**, no de una variable. Así los
  dominios de previsualización de Vercel funcionan solos; lo que sí falla es un
  despliegue con *Deployment Protection* activa, porque `/api/mcp` se llama a sí
  mismo y el proxy lo mandaría al login de Vercel.
- **Cada llamada a una herramienta da una vuelta HTTP interna.** Es barato
  (Airtable ya viene cacheado por `src/lib/cache.ts`), pero si alguna vez hay
  timeouts, el botón es `export const maxDuration` en `src/app/api/mcp/route.ts`
  — sin pasarse del límite del plan de Vercel, que si no falla el despliegue.

---

## Local: para desarrollo

1. `npm install` en la raíz.

2. Agrega al `.env.local` de la raíz:

   ```
   CRM_MCP_URL=http://localhost:3000
   CRM_MCP_CEDULA=1234567890
   CRM_MCP_PASSWORD=tu-contraseña-del-CRM
   ```

   Con `CRM_MCP_SOLO_LECTURA=1` no se registran las herramientas de escritura.

3. Comprueba la configuración:

   ```
   npm run mcp:diagnostico
   ```

   Dice con qué sesión entra, qué permite su nivel y cuántos registros lee de
   cada módulo. Si algo falla, distingue entre «el CRM no responde», «la
   contraseña no sirve» y «el nivel de acceso no alcanza».

4. En **Claude Code** ya está: el `.mcp.json` de la raíz lo declara y se pide
   aprobación una vez al abrir el proyecto. En **Claude Desktop**, la ruta a
   `mcp/servidor.mjs` tiene que ser absoluta; el `.env.local` se sigue leyendo
   de la raíz del repo.

---

## Herramientas

**Consulta** — el cliente MCP puede correrlas sin preguntar.

| Herramienta | Para qué |
| --- | --- |
| `crm_quien_soy` | Con qué sesión entra el conector y qué permite su nivel. |
| `crm_resumen` | KPIs, pendientes atrasados, seguimientos, actividad, equipo. |
| `crm_buscar_clientes` | El maestro, con filtro de texto libre. |
| `crm_detalle_cliente` | Ficha, contactos, visitas, casos y pedidos de un cliente. |
| `crm_listar_contactos` | Personas dentro de los clientes. |
| `crm_listar_visitas` | Visitas por cliente, fecha, responsable o resultado. |
| `crm_listar_casos` | Casos PQRSF, con filtro de pendientes y vencidos. |
| `crm_listar_pedidos` | Pedidos con sus renglones y su total. |
| `crm_listar_productos` | Catálogo con precio de lista. |

**Escritura** — quedan en Airtable y las lee el resto del equipo. En el conector
remoto solo aparecen si la persona concedió el permiso al autorizar.

| Herramienta | Para qué |
| --- | --- |
| `crm_registrar_visita` | Deja una visita comercial. |
| `crm_actualizar_visita` | Corrige una ya registrada. |
| `crm_gestionar_seguimiento` | Reprograma o cierra el compromiso de una visita. |
| `crm_abrir_caso` | Abre un caso PQRSF. |
| `crm_actualizar_caso` | Mueve el estado, corrige datos o cambia el plazo. |
| `crm_crear_pedido` | Registra un pedido con sus renglones. |
| `crm_cambiar_estado_pedido` | Mueve un pedido de estado. |

Dos comodidades que valen la pena conocer:

- **Los clientes y los productos se nombran en español corriente.** «Palmar del
  Oriente», `CL-0007` o el record id sirven igual. Cuando el nombre da para
  varios, la herramienta devuelve los candidatos en vez de adivinar: registrar
  una visita a la empresa equivocada es peor que preguntar.
- **Al editar basta el campo que cambia.** Los `PATCH` de visitas y casos
  revalidan el registro completo, así que el conector lo relee y rellena lo que
  no vino. Sin eso, corregir solo el resultado de una visita la dejaría sin
  objetivo.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `servidor-comun.mjs` | Registra las herramientas. Lo comparten los dos transportes. |
| `herramientas-lectura.mjs` | Las nueve de consulta. |
| `herramientas-escritura.mjs` | Las siete que escriben. |
| `cliente-crm.mjs` | Las llamadas HTTP al CRM, con sesión por login o por cookie. |
| `comun.mjs` | Resolver cliente/producto por nombre, filtros, formato. |
| `opciones.mjs` | Copia de las listas de opciones del CRM. |
| `servidor.mjs` | Arranque del transporte stdio. |
| `entorno.mjs` | Lee `.env.local` (Claude arranca el proceso sin shell). |
| `diagnostico.mjs` | Comprobación del conector local. |
| `probar-oauth.mjs` | Prueba de punta a punta del flujo remoto. |

Del lado del CRM: `src/app/api/mcp/` (el endpoint), `src/app/api/oauth/` (el
servidor de autorización), `src/app/autorizar/` (la pantalla) y
`src/lib/mcp/` (tokens y CORS).

`opciones.mjs` es una copia (este servidor corre en Node plano, sin TypeScript
ni el alias `@/`), y una copia se desfasa en silencio. Por eso
`src/lib/opciones-mcp.test.ts` la compara contra las constantes reales de
`src/lib/*-comun.ts` y falla si alguien agrega una opción en un solo lado.

## Seguridad

- OAuth con **PKCE S256 obligatorio**, clientes públicos y comparación exacta
  del `redirect_uri`. Los errores no se redirigen hasta que ese `redirect_uri`
  está verificado contra el registro del cliente.
- La pantalla de autorización **no deja sesión del dashboard abierta**: lo único
  que produce es el código. Y tiene el mismo límite de intentos que el login.
- El `.env.local` del conector local ya está en `.gitignore`. No lo commitees.
- Si quieres que Claude vea menos que tú, crea una cuenta con un nivel más bajo
  en Sirius Nomina Core.
