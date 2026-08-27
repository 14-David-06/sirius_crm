import { describe, expect, it } from "vitest";

import {
  normalizeCedula,
  primerNombre,
  validatePassword,
} from "@/lib/validation";

/**
 * Datos inventados a propósito: nunca cédulas ni nombres de personas reales
 * en el código fuente.
 */

describe("normalizeCedula", () => {
  it("quita puntos, espacios y guiones", () => {
    expect(normalizeCedula("1.234.567.890")).toBe("1234567890");
    expect(normalizeCedula(" 1234 567 890 ")).toBe("1234567890");
    expect(normalizeCedula("1234-567-890")).toBe("1234567890");
  });

  it("rechaza lo que no llega a 5 dígitos o pasa de 15", () => {
    expect(normalizeCedula("1234")).toBeNull();
    expect(normalizeCedula("1".repeat(16))).toBeNull();
  });

  it("acepta los extremos del rango", () => {
    expect(normalizeCedula("12345")).toBe("12345");
    expect(normalizeCedula("1".repeat(15))).toBe("1".repeat(15));
  });

  it("rechaza lo que no es texto o no tiene dígitos", () => {
    expect(normalizeCedula(null)).toBeNull();
    expect(normalizeCedula(12345)).toBeNull();
    expect(normalizeCedula("abcdefgh")).toBeNull();
    expect(normalizeCedula("")).toBeNull();
  });
});

describe("validatePassword", () => {
  it("acepta una contraseña con letra, número y largo suficiente", () => {
    expect(validatePassword("sirius2026")).toBeNull();
  });

  it("exige al menos 8 caracteres", () => {
    expect(validatePassword("abc1234")).toContain("8 caracteres");
  });

  it("exige letra y número", () => {
    expect(validatePassword("12345678")).toContain("letra");
    expect(validatePassword("abcdefgh")).toContain("número");
  });

  it("corta en 72 caracteres, que es el tope de bcrypt", () => {
    // Más allá de 72 bytes bcrypt ignora el resto en silencio: aceptarlo
    // daría una falsa sensación de contraseña más fuerte.
    expect(validatePassword("a1" + "x".repeat(70))).toBeNull();
    expect(validatePassword("a1" + "x".repeat(71))).toContain("72");
  });

  it("rechaza lo que no es texto", () => {
    expect(validatePassword(null)).not.toBeNull();
    expect(validatePassword(12345678)).not.toBeNull();
  });
});

describe("primerNombre", () => {
  /**
   * `/api/auth/lookup` responde sin autenticación, así que no debe entregar
   * el nombre legal completo de nadie.
   */
  it("deja solo el primer nombre", () => {
    expect(primerNombre("Ana Maria Ejemplo Uno")).toBe("Ana");
    expect(primerNombre("Beto Ejemplo")).toBe("Beto");
  });

  it("no revela apellidos ni segundos nombres", () => {
    const corto = primerNombre("Carla Ficticia Segundo Tercero");
    expect(corto).toBe("Carla");
    for (const parte of ["Ficticia", "Segundo", "Tercero"]) {
      expect(corto).not.toContain(parte);
    }
  });

  it("aguanta espacios de más, que los hay en la tabla de Personal", () => {
    expect(primerNombre("  Dora  Ejemplo Cuatro ")).toBe("Dora");
  });

  it("devuelve vacío si no hay nombre", () => {
    expect(primerNombre("")).toBe("");
    expect(primerNombre("   ")).toBe("");
  });

  it("deja igual un nombre de una sola palabra", () => {
    expect(primerNombre("Beto")).toBe("Beto");
  });
});
