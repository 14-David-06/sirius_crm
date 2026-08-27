import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El camino de Redis. Se prueba aparte porque el módulo lee las variables de
 * entorno al importarse, así que hay que ponerlas antes y reimportar en
 * limpio con `vi.resetModules()`.
 */

const URL_FALSA = "https://redis-de-prueba.upstash.io";

type Llamada = { url: string; cuerpo: unknown };

let llamadas: Llamada[];
let respuesta: () => Response;

async function cargarModulo() {
  vi.resetModules();
  process.env.UPSTASH_REDIS_REST_URL = URL_FALSA;
  process.env.UPSTASH_REDIS_REST_TOKEN = "token-de-prueba";
  return import("@/lib/rate-limit");
}

beforeEach(() => {
  llamadas = [];
  respuesta = () =>
    new Response(JSON.stringify([{ result: 1 }, { result: 1 }]), {
      status: 200,
    });

  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    llamadas.push({
      url: String(url),
      cuerpo: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return respuesta();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("con Redis configurado", () => {
  it("se reconoce como persistente", async () => {
    const { limitePersistente } = await cargarModulo();
    expect(limitePersistente()).toBe(true);
  });

  it("cuenta las dos dimensiones en Redis, no en memoria", async () => {
    const { excedeIntentos } = await cargarModulo();
    await excedeIntentos("login", "123", "1.2.3.4");

    expect(llamadas).toHaveLength(2);
    const claves = llamadas.flatMap((l) =>
      (l.cuerpo as string[][]).map((c) => c[1]),
    );
    expect(claves).toContain("intentos:login:cedula:123");
    expect(claves).toContain("intentos:login:ip:1.2.3.4");
  });

  it("usa INCR con EXPIRE NX, para que insistir no alargue el castigo", async () => {
    const { excedeIntentos } = await cargarModulo();
    await excedeIntentos("login", "123", "1.2.3.4");

    const pipeline = llamadas[0].cuerpo as string[][];
    expect(pipeline[0][0]).toBe("INCR");
    expect(pipeline[1][0]).toBe("EXPIRE");
    // Sin "NX", cada intento reiniciaría la ventana y nunca se agotaría.
    expect(pipeline[1]).toContain("NX");
  });

  it("rechaza cuando Redis devuelve una cuenta sobre el tope", async () => {
    const { excedeIntentos, POR_CEDULA } = await cargarModulo();
    respuesta = () =>
      new Response(
        JSON.stringify([{ result: POR_CEDULA.max + 1 }, { result: 1 }]),
        { status: 200 },
      );

    expect(await excedeIntentos("login", "123", "1.2.3.4")).toBe(true);
  });

  it("deja pasar cuando la cuenta va justo en el tope", async () => {
    const { excedeIntentos, POR_CEDULA } = await cargarModulo();
    respuesta = () =>
      new Response(JSON.stringify([{ result: POR_CEDULA.max }, { result: 1 }]), {
        status: 200,
      });

    expect(await excedeIntentos("login", "123", "1.2.3.4")).toBe(false);
  });

  it("borra la clave de la cédula al ingresar bien", async () => {
    const { olvidarIntentos } = await cargarModulo();
    await olvidarIntentos("login", "123");

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toContain("/del/");
    expect(llamadas[0].url).toContain(encodeURIComponent("intentos:login:cedula:123"));
  });
});

describe("cuando Redis falla", () => {
  it("cae al contador en memoria en vez de dejar pasar todo", async () => {
    const { excedeIntentos, POR_CEDULA } = await cargarModulo();
    respuesta = () => new Response("boom", { status: 500 });
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Con Redis caído se sigue contando: al pasar el tope, rechaza.
    for (let i = 0; i < POR_CEDULA.max; i += 1) {
      expect(await excedeIntentos("login", "777", "9.9.9.9")).toBe(false);
    }
    expect(await excedeIntentos("login", "777", "9.9.9.9")).toBe(true);
  });

  it("no rechaza a la primera por un fallo del almacén", async () => {
    // Bloquear a todo el mundo porque Redis se cayó sería peor que el problema.
    const { excedeIntentos } = await cargarModulo();
    respuesta = () => new Response("boom", { status: 500 });
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await excedeIntentos("login", "888", "9.9.9.8")).toBe(false);
  });

  it("también aguanta una respuesta ilegible", async () => {
    const { excedeIntentos } = await cargarModulo();
    respuesta = () =>
      new Response(JSON.stringify([{ result: "no es un numero" }]), {
        status: 200,
      });
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await excedeIntentos("login", "999", "9.9.9.7")).toBe(false);
  });
});
