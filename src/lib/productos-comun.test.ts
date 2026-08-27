import { describe, expect, it } from "vitest";

import { formatearPrecio, leerPrecio } from "@/lib/productos-comun";

describe("leerPrecio", () => {
  it("trata el cero como un precio real, no como ausencia", () => {
    // Cuatro productos del catálogo están en cero: muestras y ensayos.
    expect(leerPrecio(0)).toBe(0);
    expect(leerPrecio("0")).toBe(0);
  });

  it("distingue vacío de cero", () => {
    expect(leerPrecio("")).toBeNull();
    expect(leerPrecio(null)).toBeNull();
    expect(leerPrecio(undefined)).toBeNull();
  });

  it("rechaza negativos y lo que no es número", () => {
    expect(leerPrecio(-1)).toBe("invalido");
    expect(leerPrecio("-5")).toBe("invalido");
    expect(leerPrecio("abc")).toBe("invalido");
    expect(leerPrecio(Infinity)).toBe("invalido");
    expect(leerPrecio(NaN)).toBe("invalido");
  });

  it("acepta el número como texto, que es como llega del formulario", () => {
    expect(leerPrecio("45000")).toBe(45000);
  });
});

describe("formatearPrecio", () => {
  it("no inventa un cero cuando no hay precio", () => {
    expect(formatearPrecio(null, "L")).toBe("—");
  });

  it("muestra el cero como precio, con su unidad", () => {
    expect(formatearPrecio(0, "Kg")).toContain("/ Kg");
    expect(formatearPrecio(0, "Kg")).not.toBe("—");
  });

  it("agrega la unidad solo si la hay", () => {
    expect(formatearPrecio(45000, "L")).toContain("/ L");
    expect(formatearPrecio(45000, null)).not.toContain("/");
  });
});
