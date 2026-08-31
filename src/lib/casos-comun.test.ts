import { describe, expect, it } from "vitest";

import {
  alertaPorFecha,
  anotarHistorial,
  describirCambio,
  ESTADOS_CASO,
  estaCerrado,
  exigeSolucion,
  TIPOS_CASO,
} from "@/lib/casos-comun";

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
    // PQRSF primero, que es lo que se ofrece al abrir un caso nuevo; después
    // la clasificación anterior, que se conserva para los ya registrados.
    expect([...TIPOS_CASO]).toEqual([
      "Petición",
      "Queja",
      "Reclamo",
      "Sugerencia",
      "Felicitación",
      "Otro",
      "Comercial",
      "Técnico o agronómico",
      "Queja o reclamo",
      "Solicitud de información",
    ]);
  });
});

describe("anotarHistorial", () => {
  it("crea la primera línea con fecha y autor", () => {
    expect(anotarHistorial(null, "Caso abierto", "2026-08-31", "SIRIUS-PER-0001"))
      .toBe("[2026-08-31] SIRIUS-PER-0001 · Caso abierto");
  });

  it("agrega al final sin tocar lo anterior", () => {
    const previo = "[2026-08-30] SIRIUS-PER-0001 · Caso abierto";
    const nuevo = anotarHistorial(
      previo,
      "Estado: Abierto → Resuelto",
      "2026-08-31",
      "SIRIUS-PER-0002",
    );

    expect(nuevo.startsWith(previo)).toBe(true);
    expect(nuevo.split("\n")).toHaveLength(2);
    expect(nuevo).toContain("Estado: Abierto → Resuelto");
  });

  it("no deja una línea en blanco si el historial venía vacío", () => {
    expect(anotarHistorial("   ", "algo", "2026-08-31", "X")).toBe(
      "[2026-08-31] X · algo",
    );
  });

  it("sigue anotando aunque la sesión no traiga ID de empleado", () => {
    expect(anotarHistorial(null, "algo", "2026-08-31", "")).toContain("sin ID");
  });
});

describe("describirCambio", () => {
  it("no anota nada cuando el valor no cambió", () => {
    expect(describirCambio("Tipo", "Queja", "Queja")).toBeNull();
    // Vacío, nulo y espacios son el mismo "sin dato".
    expect(describirCambio("Nota", null, "  ")).toBeNull();
  });

  it("distingue agregar, borrar y cambiar", () => {
    expect(describirCambio("Nota", null, "hola")).toBe("Nota: se agregó");
    expect(describirCambio("Nota", "hola", null)).toBe("Nota: se borró");
    expect(describirCambio("Tipo", "Queja", "Reclamo")).toBe(
      "Tipo: «Queja» → «Reclamo»",
    );
  });

  it("no copia textos largos: la bitácora quedaría ilegible", () => {
    const largo = "x".repeat(80);
    expect(describirCambio("Descripción", "corto", largo)).toBe(
      "Descripción: cambió",
    );
  });
});

describe("exigeSolucion", () => {
  it("solo al resolver o cerrar", () => {
    expect(exigeSolucion("Resuelto")).toBe(true);
    expect(exigeSolucion("Cerrado")).toBe(true);
    expect(exigeSolucion("Abierto")).toBe(false);
    expect(exigeSolucion("En proceso")).toBe(false);
    expect(exigeSolucion(null)).toBe(false);
  });
});

describe("TIPOS_CASO", () => {
  it("ofrece PQRSF sin descartar la clasificación anterior", () => {
    // Los casos ya abiertos con los tipos viejos siguen siendo válidos.
    expect(TIPOS_CASO).toContain("Petición");
    expect(TIPOS_CASO).toContain("Felicitación");
    expect(TIPOS_CASO).toContain("Comercial");
    expect(TIPOS_CASO).toContain("Queja o reclamo");
  });

  it("no repite «Otro» entre los dos grupos", () => {
    expect(TIPOS_CASO.filter((t) => t === "Otro")).toHaveLength(1);
  });
});
