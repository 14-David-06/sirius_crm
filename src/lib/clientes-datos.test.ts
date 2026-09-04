/**
 * `leerDatosCliente` es la única definición de qué ficha de cliente se acepta:
 * la usan tanto el POST que registra como el PATCH que corrige. Si se
 * separaran, un cliente podría nacer con algo que al editarlo se rechaza —o al
 * revés— y nadie lo notaría hasta que alguien intentara corregirlo.
 */

import { describe, expect, it } from "vitest";

import {
  esErrorDatosCliente,
  leerDatosCliente,
  type CambiosCliente,
} from "@/lib/clientes";

function leer(body: Record<string, unknown>) {
  return leerDatosCliente(body);
}

/** La ficha resultante, o falla la prueba si vino un error. */
function ficha(body: Record<string, unknown>): CambiosCliente {
  const datos = leer(body);
  if (esErrorDatosCliente(datos)) {
    throw new Error(`Se esperaba una ficha válida, vino: ${datos.error}`);
  }
  return datos;
}

function error(body: Record<string, unknown>): string {
  const datos = leer(body);
  if (!esErrorDatosCliente(datos)) {
    throw new Error("Se esperaba un error y la ficha pasó");
  }
  return datos.error;
}

describe("leerDatosCliente · nombre", () => {
  it("es obligatorio", () => {
    expect(error({})).toMatch(/nombre/i);
    expect(error({ nombre: "   " })).toMatch(/nombre/i);
  });

  it("se recorta", () => {
    expect(ficha({ nombre: "  Agrícola Guarila SAS  " }).nombre).toBe(
      "Agrícola Guarila SAS",
    );
  });
});

describe("leerDatosCliente · cuerpo ausente", () => {
  it("no revienta con null", () => {
    const datos = leerDatosCliente(null);
    expect(esErrorDatosCliente(datos)).toBe(true);
  });
});

describe("leerDatosCliente · canal de conocimiento", () => {
  it("acepta un canal definido", () => {
    expect(ficha({ nombre: "X", comoConocio: "Feria o evento" }).comoConocio).toBe(
      "Feria o evento",
    );
  });

  it("rechaza uno inventado", () => {
    expect(error({ nombre: "X", comoConocio: "Paloma mensajera" })).toMatch(
      /no es uno de los definidos/i,
    );
  });

  it("con «Otro» exige el detalle", () => {
    expect(error({ nombre: "X", comoConocio: "Otro" })).toMatch(/cuál fue/i);
  });

  it("con «Otro» guarda el detalle", () => {
    const datos = ficha({
      nombre: "X",
      comoConocio: "Otro",
      comoConocioDetalle: "Nos escribió por LinkedIn",
    });
    expect(datos.comoConocioDetalle).toBe("Nos escribió por LinkedIn");
  });

  it("descarta el detalle cuando el canal no es «Otro»", () => {
    // Un detalle viejo junto a otro canal deja el registro contradiciéndose.
    const datos = ficha({
      nombre: "X",
      comoConocio: "Feria o evento",
      comoConocioDetalle: "texto que sobró",
    });
    expect(datos.comoConocioDetalle).toBeNull();
  });

  it("sin canal no exige nada", () => {
    expect(ficha({ nombre: "X" }).comoConocio).toBeNull();
  });
});

describe("leerDatosCliente · distancia a bodega", () => {
  it("acepta un número", () => {
    expect(ficha({ nombre: "X", distanciaBodegaKm: "120" }).distanciaBodegaKm).toBe(
      120,
    );
  });

  it("acepta quedarse vacía", () => {
    expect(ficha({ nombre: "X", distanciaBodegaKm: "" }).distanciaBodegaKm).toBeNull();
  });

  it("rechaza lo que no es número", () => {
    expect(error({ nombre: "X", distanciaBodegaKm: "lejos" })).toMatch(
      /kilómetros/i,
    );
  });

  it("rechaza una distancia negativa", () => {
    expect(error({ nombre: "X", distanciaBodegaKm: -5 })).toMatch(/kilómetros/i);
  });

  it("el cero es una distancia real: el cliente está en la bodega", () => {
    expect(ficha({ nombre: "X", distanciaBodegaKm: 0 }).distanciaBodegaKm).toBe(0);
  });
});

describe("leerDatosCliente · fecha de vinculación", () => {
  it("acepta YYYY-MM-DD", () => {
    expect(ficha({ nombre: "X", vinculacion: "2026-01-09" }).vinculacion).toBe(
      "2026-01-09",
    );
  });

  it("rechaza cualquier otro formato", () => {
    expect(error({ nombre: "X", vinculacion: "09/01/2026" })).toMatch(
      /no es válida/i,
    );
  });

  it("acepta quedarse vacía", () => {
    expect(ficha({ nombre: "X", vinculacion: "" }).vinculacion).toBeNull();
  });
});

describe("leerDatosCliente · campos de texto", () => {
  it("los vacíos quedan en null, no en cadena vacía", () => {
    const datos = ficha({ nombre: "X", nit: "", ciudad: "  " });
    expect(datos.nit).toBeNull();
    expect(datos.ciudad).toBeNull();
  });

  it("ignora lo que no es texto en vez de guardarlo como tal", () => {
    const datos = ficha({ nombre: "X", nit: 900123456, ciudad: ["Maní"] });
    expect(datos.nit).toBeNull();
    expect(datos.ciudad).toBeNull();
  });

  it("lee la ficha completa", () => {
    const datos = ficha({
      nombre: "Agrícola Guarila SAS",
      nit: "901145626-1",
      direccion: "Calle 20 7 86",
      ciudad: "Maní",
      departamento: "Casanare",
      coordenadas: "4.81, -72.28",
      distanciaBodegaKm: 1,
      sector: "Palma",
      segmento: "Alto",
      etapa: "Prospecto",
      responsableComercial: "Angélica Herrera",
      vinculacion: "2026-01-09",
      observaciones: "Llegó por referido",
    });

    expect(datos).toMatchObject({
      nombre: "Agrícola Guarila SAS",
      nit: "901145626-1",
      ciudad: "Maní",
      departamento: "Casanare",
      distanciaBodegaKm: 1,
      vinculacion: "2026-01-09",
    });
  });

  it("no deja colar campos que la ficha no administra", () => {
    // El serial, el estado y la auditoría no se escriben desde el formulario.
    const datos = ficha({
      nombre: "X",
      id: "CL-9999",
      estado: "Inactivo",
      creadoPor: "SIRIUS-PER-0001",
    });

    expect(datos).not.toHaveProperty("id");
    expect(datos).not.toHaveProperty("estado");
    expect(datos).not.toHaveProperty("creadoPor");
  });
});
