import { describe, expect, it } from "vitest";

import {
  codigosDelCatalogo,
  formatearPrecio,
  leerPrecio,
} from "@/lib/productos-comun";

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

describe("codigosDelCatalogo", () => {
  const CATALOGO = [
    { codigo: "SIRIUS-PRODUCT-0001" },
    { codigo: "SIRIUS-PRODUCT-0004" },
    { codigo: "SIRIUS-PRODUCT-0009" }, // descontinuado, pero sigue existiendo
  ];

  it("cruza los códigos guardados como texto con el catálogo", () => {
    expect(
      codigosDelCatalogo("SIRIUS-PRODUCT-0001, SIRIUS-PRODUCT-0004", CATALOGO),
    ).toEqual(["SIRIUS-PRODUCT-0001", "SIRIUS-PRODUCT-0004"]);
  });

  it("conserva un producto descontinuado que el registro ya referenciaba", () => {
    // La regla del catálogo: un producto con historial no se borra. Si aquí se
    // descartara, editar la visita lo sacaría del registro en silencio.
    expect(codigosDelCatalogo("SIRIUS-PRODUCT-0009", CATALOGO)).toEqual([
      "SIRIUS-PRODUCT-0009",
    ]);
  });

  it("descarta un código que ya no está en el catálogo", () => {
    expect(
      codigosDelCatalogo("SIRIUS-PRODUCT-0001, SIRIUS-PRODUCT-9999", CATALOGO),
    ).toEqual(["SIRIUS-PRODUCT-0001"]);
  });

  it("tolera el texto sucio que deja un formulario", () => {
    expect(codigosDelCatalogo(",, SIRIUS-PRODUCT-0004 ,", CATALOGO)).toEqual([
      "SIRIUS-PRODUCT-0004",
    ]);
    expect(codigosDelCatalogo("", CATALOGO)).toEqual([]);
    expect(codigosDelCatalogo(null, CATALOGO)).toEqual([]);
  });

  it("devuelve el orden del catálogo, no el del texto guardado", () => {
    expect(
      codigosDelCatalogo("SIRIUS-PRODUCT-0004, SIRIUS-PRODUCT-0001", CATALOGO),
    ).toEqual(["SIRIUS-PRODUCT-0001", "SIRIUS-PRODUCT-0004"]);
  });
});
