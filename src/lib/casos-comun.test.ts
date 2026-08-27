import { describe, expect, it } from "vitest";

import { alertaPorFecha, ESTADOS_CASO, estaCerrado, TIPOS_CASO } from "@/lib/casos-comun";

const HOY = "2026-08-27";

describe("estaCerrado", () => {
  it("solo Resuelto y Cerrado dejan de exigir acción", () => {
    expect(estaCerrado("Resuelto")).toBe(true);
    expect(estaCerrado("Cerrado")).toBe(true);
    expect(estaCerrado("Abierto")).toBe(false);
    expect(estaCerrado("En proceso")).toBe(false);
    expect(estaCerrado(null)).toBe(false);
  });
});

describe("alertaPorFecha", () => {
  it("un caso cerrado no tiene alerta de plazo", () => {
    // Aunque su fecha límite haya pasado hace meses.
    expect(alertaPorFecha("Resuelto", "2026-01-01", HOY)).toBe("cerrado");
  });

  it("sin fecha límite queda sin plazo", () => {
    expect(alertaPorFecha("Abierto", null, HOY)).toBe("sin-plazo");
  });

  it("distingue vencido, hoy y en plazo", () => {
    expect(alertaPorFecha("Abierto", "2026-08-26", HOY)).toBe("vencido");
    expect(alertaPorFecha("Abierto", "2026-08-27", HOY)).toBe("hoy");
    expect(alertaPorFecha("Abierto", "2026-08-28", HOY)).toBe("en-plazo");
  });

  it("el día del plazo todavía cuenta como a tiempo", () => {
    // Vencer "hoy" no es estar vencido: aún queda la jornada.
    expect(alertaPorFecha("En proceso", HOY, HOY)).not.toBe("vencido");
  });
});

describe("catálogos", () => {
  it("coinciden con las opciones del singleSelect de Airtable", () => {
    // Si alguien cambia una opción en Airtable, este test lo delata.
    expect([...ESTADOS_CASO]).toEqual([
      "Abierto",
      "En proceso",
      "Resuelto",
      "Cerrado",
    ]);
    expect([...TIPOS_CASO]).toEqual([
      "Comercial",
      "Técnico o agronómico",
      "Queja o reclamo",
      "Solicitud de información",
      "Otro",
    ]);
  });
});
