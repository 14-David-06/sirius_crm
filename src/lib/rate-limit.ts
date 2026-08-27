/**
 * Límite de intentos para las rutas de autenticación.
 *
 * Se limita en dos dimensiones a la vez y basta que una se pase:
 *
 *  - Por cédula: protege una cuenta concreta de que le adivinen la contraseña.
 *  - Por IP: protege el padrón completo. Sin esta, probar mil cédulas
 *    distintas no encuentra ningún límite, porque cada una arranca su propio
 *    contador — es el hueco que deja limitar solo por cuenta.
 *
 * El almacén es Redis por HTTP (Upstash o compatible) cuando está configurado,
 * y un Map en memoria cuando no. En memoria alcanza para una sola instancia:
 * en Vercel cada lambda tiene el suyo, así que el límite real se multiplica
 * por el número de instancias y se borra en cada despliegue.
 *
 * Se habla con Redis por `fetch` contra su API REST, sin sumar dependencia,
 * igual que se hace con Airtable.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL?.trim();
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

/** True si hay un almacén compartido detrás. */
export function limitePersistente(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

export type Regla = { max: number; ventanaSegundos: number };

/** Un intento contra una cuenta concreta. */
export const POR_CEDULA: Regla = { max: 8, ventanaSegundos: 10 * 60 };

/**
 * Un intento desde una misma IP, contra cualquier cédula. Más holgado que el
 * de cuenta porque una oficina entera puede salir por la misma IP, pero lo
 * bastante bajo para que recorrer el padrón no sea práctico.
 */
export const POR_IP: Regla = { max: 30, ventanaSegundos: 10 * 60 };

/* ------------------------------- Almacenes ------------------------------- */

const enMemoria = new Map<string, { cuenta: number; expiraEn: number }>();

function contarEnMemoria(clave: string, ventanaSegundos: number): number {
  const ahora = Date.now();
  const entrada = enMemoria.get(clave);

  if (!entrada || entrada.expiraEn < ahora) {
    enMemoria.set(clave, {
      cuenta: 1,
      expiraEn: ahora + ventanaSegundos * 1000,
    });
    return 1;
  }

  entrada.cuenta += 1;
  return entrada.cuenta;
}

/**
 * INCR + EXPIRE en una sola llamada. El EXPIRE va con `NX` para no reiniciar
 * la ventana en cada intento: si no, quien insiste sin parar la extiende para
 * siempre y nunca se le agota el castigo.
 */
async function contarEnRedis(
  clave: string,
  ventanaSegundos: number,
): Promise<number> {
  const respuesta = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", clave],
      ["EXPIRE", clave, String(ventanaSegundos), "NX"],
    ]),
    cache: "no-store",
  });

  if (!respuesta.ok) {
    throw new Error(`Redis ${respuesta.status}`);
  }

  const datos = (await respuesta.json()) as { result?: unknown }[];
  const cuenta = Number(datos[0]?.result);

  if (!Number.isFinite(cuenta)) {
    throw new Error("Redis devolvió una cuenta ilegible");
  }

  return cuenta;
}

let avisoDado = false;

/**
 * Suma un intento y dice si ya se pasó del límite.
 *
 * Si Redis falla se cae al Map en memoria en vez de dejar pasar todo: un
 * límite por instancia protege menos, pero protege. Bloquear a todo el mundo
 * porque el almacén se cayó sería peor que el problema.
 */
async function contar(clave: string, regla: Regla): Promise<number> {
  if (!limitePersistente()) {
    if (!avisoDado && process.env.NODE_ENV === "production") {
      avisoDado = true;
      console.warn(
        "Límite de intentos sin Redis: en producción con varias instancias el tope real es por instancia. Configura UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN.",
      );
    }
    return contarEnMemoria(clave, regla.ventanaSegundos);
  }

  try {
    return await contarEnRedis(clave, regla.ventanaSegundos);
  } catch (error) {
    console.error("límite de intentos contra Redis", error);
    return contarEnMemoria(clave, regla.ventanaSegundos);
  }
}

/* --------------------------------- API ---------------------------------- */

/** La IP del cliente según la cabecera que pone el proxy de despliegue. */
export function ipDe(request: Request): string {
  const cabecera =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "";
  // x-forwarded-for puede traer varias: la primera es el cliente original.
  const primera = cabecera.split(",")[0]?.trim();
  return primera || "ip-desconocida";
}

/**
 * Comprueba las dos dimensiones. Devuelve true si hay que rechazar.
 *
 * `accion` separa los contadores: agotar los intentos de login no debe dejar
 * a la persona sin poder crear su contraseña.
 */
export async function excedeIntentos(
  accion: string,
  cedula: string,
  ip: string,
): Promise<boolean> {
  const [porCedula, porIp] = await Promise.all([
    contar(`intentos:${accion}:cedula:${cedula}`, POR_CEDULA),
    contar(`intentos:${accion}:ip:${ip}`, POR_IP),
  ]);

  return porCedula > POR_CEDULA.max || porIp > POR_IP.max;
}

/** Borra el contador de una cédula tras un ingreso correcto. */
export async function olvidarIntentos(
  accion: string,
  cedula: string,
): Promise<void> {
  const clave = `intentos:${accion}:cedula:${cedula}`;
  enMemoria.delete(clave);

  if (!limitePersistente()) return;

  try {
    await fetch(`${REDIS_URL}/del/${encodeURIComponent(clave)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
      cache: "no-store",
    });
  } catch (error) {
    // No es grave: el contador expira solo al cerrarse la ventana.
    console.error("olvidar intentos", error);
  }
}

/** Solo para las pruebas: deja los contadores en memoria como recién nacidos. */
export function reiniciarParaPruebas(): void {
  enMemoria.clear();
  avisoDado = false;
}
