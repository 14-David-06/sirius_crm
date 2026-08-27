import { describe, expect, it } from "vitest";

import { formatearFecha } from "@/lib/fechas";

describe("formatearFecha", () => {
  it("formatea en español sin pasar por Date", () => {
    // Pasar por Date correría la fecha un día según la zona del navegador.
    expect(formatearFecha("2026-08-27")).toBe("27 ago 2026");
    expect(formatearFecha("2026-01-01")).toBe("1 ene 2026");
    expect(formatearFecha("2026-12-31")).toBe("31 dic 2026");
  });

  it("recorta una fecha con hora, como la devuelve Airtable", () => {
    expect(formatearFecha("2026-08-27T13:34:16.000Z")).toBe("27 ago 2026");
  });

  it("muestra una raya cuando no hay fecha", () => {
    expect(formatearFecha(null)).toBe("—");
  });

  it("devuelve el valor tal cual si no lo entiende, sin inventar", () => {
    expect(formatearFecha("no es fecha")).toBe("no es fecha");
  });
});
