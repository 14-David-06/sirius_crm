import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  excedeIntentos,
  ipDe,
  limitePersistente,
  olvidarIntentos,
  POR_CEDULA,
  POR_IP,
  reiniciarParaPruebas,
} from "@/lib/rate-limit";

/**
 * Sin variables de Redis, el módulo usa el Map en memoria: estas pruebas
 * ejercitan ese camino, que es el que corre hoy en producción.
 */

beforeEach(() => {
  reiniciarParaPruebas();
});

const IP = "200.1.2.3";

describe("configuración", () => {
  it("sin variables de Redis no hay almacén persistente", () => {
    expect(limitePersistente()).toBe(false);
  });
});

describe("ipDe", () => {
  it("toma la primera IP de x-forwarded-for", () => {
    // El proxy encadena: cliente, luego los intermedios.
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "200.1.2.3, 10.0.0.1, 172.16.0.1" },
    });
    expect(ipDe(req)).toBe("200.1.2.3");
  });

  it("cae a x-real-ip si no hay forwarded-for", () => {
    const req = new Request("http://x", {
      headers: { "x-real-ip": "190.9.9.9" },
    });
    expect(ipDe(req)).toBe("190.9.9.9");
  });

  it("no devuelve vacío cuando no hay cabecera", () => {
    // Una clave vacía juntaría a todo el mundo en el mismo contador.
    expect(ipDe(new Request("http://x"))).toBe("ip-desconocida");
    expect(
      ipDe(new Request("http://x", { headers: { "x-forwarded-for": "" } })),
    ).toBe("ip-desconocida");
    expect(
      ipDe(new Request("http://x", { headers: { "x-forwarded-for": "  ,  " } })),
    ).toBe("ip-desconocida");
  });
});

describe("límite por cédula", () => {
  it("deja pasar hasta el máximo y rechaza después", async () => {
    for (let i = 0; i < POR_CEDULA.max; i += 1) {
      expect(await excedeIntentos("login", "123456", IP), `intento ${i + 1}`).toBe(
        false,
      );
    }
    expect(await excedeIntentos("login", "123456", IP)).toBe(true);
  });

  it("cuenta cada cédula por separado", async () => {
    for (let i = 0; i < POR_CEDULA.max + 1; i += 1) {
      await excedeIntentos("login", "111111", IP);
    }
    // Otra cédula, desde otra IP para no chocar con el tope de IP.
    expect(await excedeIntentos("login", "222222", "200.9.9.9")).toBe(false);
  });

  it("separa las acciones: agotar el login no bloquea crear contraseña", async () => {
    for (let i = 0; i < POR_CEDULA.max + 1; i += 1) {
      await excedeIntentos("login", "333333", IP);
    }
    expect(await excedeIntentos("login", "333333", IP)).toBe(true);
    expect(await excedeIntentos("set-password", "333333", "200.8.8.8")).toBe(
      false,
    );
  });

  it("un ingreso correcto borra el contador de esa cédula", async () => {
    for (let i = 0; i < POR_CEDULA.max; i += 1) {
      await excedeIntentos("login", "444444", IP);
    }
    await olvidarIntentos("login", "444444");
    expect(await excedeIntentos("login", "444444", IP)).toBe(false);
  });

  it("olvidar una cédula no descuenta el contador de la IP", async () => {
    // Si lo hiciera, bastaría un ingreso válido para reiniciar el tope de IP
    // y seguir recorriendo el padrón.
    for (let i = 0; i < POR_IP.max; i += 1) {
      await excedeIntentos("login", `c${i}`, "201.1.1.1");
    }
    await olvidarIntentos("login", "c0");
    expect(await excedeIntentos("login", "nueva", "201.1.1.1")).toBe(true);
  });
});

describe("límite por IP", () => {
  /**
   * Esta es la dimensión que faltaba: con solo el límite por cédula, probar
   * mil cédulas distintas no encontraba ningún tope.
   */
  it("corta la enumeración de cédulas distintas desde una misma IP", async () => {
    const ip = "202.5.5.5";
    let rechazadoEn: number | null = null;

    for (let i = 0; i < 200; i += 1) {
      // Cada intento con una cédula nueva: el contador por cédula nunca se llena.
      if (await excedeIntentos("lookup", `cedula-${i}`, ip)) {
        rechazadoEn = i + 1;
        break;
      }
    }

    expect(rechazadoEn).not.toBeNull();
    expect(rechazadoEn).toBe(POR_IP.max + 1);
  });

  it("no arrastra a otra IP", async () => {
    for (let i = 0; i < POR_IP.max + 1; i += 1) {
      await excedeIntentos("lookup", `x-${i}`, "203.1.1.1");
    }
    expect(await excedeIntentos("lookup", "otra", "204.2.2.2")).toBe(false);
  });

  it("el tope por IP es más holgado que el de cuenta", async () => {
    // Una oficina entera puede salir por la misma IP.
    expect(POR_IP.max).toBeGreaterThan(POR_CEDULA.max);
  });
});

describe("ventana de tiempo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("vuelve a permitir cuando la ventana se cierra", async () => {
    vi.useFakeTimers();

    for (let i = 0; i < POR_CEDULA.max + 1; i += 1) {
      await excedeIntentos("login", "555555", IP);
    }
    expect(await excedeIntentos("login", "555555", IP)).toBe(true);

    // Un segundo antes de cerrarse, sigue bloqueado.
    vi.advanceTimersByTime((POR_CEDULA.ventanaSegundos - 1) * 1000);
    expect(await excedeIntentos("login", "555555", IP)).toBe(true);

    // Pasada la ventana, el contador arranca de nuevo.
    vi.advanceTimersByTime(2 * 1000);
    expect(await excedeIntentos("login", "555555", IP)).toBe(false);
  });

  it("el castigo no se extiende por seguir insistiendo", async () => {
    vi.useFakeTimers();

    // Se llena el cupo y luego se insiste durante toda la ventana.
    for (let i = 0; i < POR_CEDULA.max + 1; i += 1) {
      await excedeIntentos("login", "666666", IP);
    }
    for (let i = 0; i < 20; i += 1) {
      vi.advanceTimersByTime((POR_CEDULA.ventanaSegundos / 20) * 1000);
      await excedeIntentos("login", "666666", IP);
    }

    // Insistir no debe reiniciar la ventana: al cerrarse, se libera.
    vi.advanceTimersByTime(2 * 1000);
    expect(await excedeIntentos("login", "666666", IP)).toBe(false);
  });
});
