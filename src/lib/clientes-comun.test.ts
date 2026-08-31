import { describe, expect, it } from "vitest";

import {
  describirCanal,
  leerFunciones,
  reconocerCanal,
  reconocerFunciones,
  reconocerTipoContacto,
} from "@/lib/clientes-comun";

describe("reconocerFunciones", () => {
  it("normaliza lo que ya está guardado en Airtable", () => {
    expect(reconocerFunciones(["compras", "  GERENCIA "])).toEqual([
      "Gerencia",
      "Compras",
    ]);
  });

  it("acepta el select viejo, que llega como un valor suelto", () => {
    expect(reconocerFunciones("Pagos")).toEqual(["Pagos"]);
  });

  it("descarta en silencio lo que no reconoce y los repetidos", () => {
    expect(reconocerFunciones(["Compras", "Marketing", "Compras"])).toEqual([
      "Compras",
    ]);
    expect(reconocerFunciones(null)).toEqual([]);
    expect(reconocerFunciones([])).toEqual([]);
  });

  it("devuelve siempre el mismo orden, sin importar cómo lleguen", () => {
    expect(reconocerFunciones(["Pagos", "Gerencia", "Compras"])).toEqual([
      "Gerencia",
      "Compras",
      "Pagos",
    ]);
  });
});

describe("leerFunciones", () => {
  it("rechaza un valor que no es una función definida", () => {
    // A diferencia de la lectura, aquí un valor extraño es un error del
    // cliente: se contesta con un mensaje en vez de guardarlo a medias.
    expect(leerFunciones(["Compras", "Marketing"])).toBe("invalido");
  });

  it("acepta la ausencia como «sin clasificar»", () => {
    expect(leerFunciones(undefined)).toEqual([]);
    expect(leerFunciones(null)).toEqual([]);
    expect(leerFunciones([])).toEqual([]);
  });

  it("ignora las cadenas vacías que manda un formulario sin tocar", () => {
    expect(leerFunciones(["", "  ", "Técnico"])).toEqual(["Técnico"]);
  });
});

describe("reconocerTipoContacto", () => {
  it("sigue reconociendo el valor suelto del select anterior", () => {
    expect(reconocerTipoContacto(" facturación ")).toBe("Facturación");
    expect(reconocerTipoContacto("Ventas")).toBeNull();
    expect(reconocerTipoContacto(null)).toBeNull();
  });
});

describe("reconocerCanal", () => {
  it("reconoce los canales con tildes y espacios de más", () => {
    expect(reconocerCanal("  página web ")).toBe("Página web");
    expect(reconocerCanal("WHATSAPP")).toBe("WhatsApp");
  });

  it("rechaza lo que no es un canal definido", () => {
    expect(reconocerCanal("Instagram")).toBeNull();
    expect(reconocerCanal("")).toBeNull();
    expect(reconocerCanal(null)).toBeNull();
  });
});

describe("describirCanal", () => {
  it("junta «Otro» con su detalle: solo no dice nada", () => {
    expect(describirCanal("Otro", "Congreso de palma")).toBe(
      "Otro — Congreso de palma",
    );
  });

  it("ignora el detalle cuando el canal no es «Otro»", () => {
    // Puede quedar texto viejo si alguien cambió de opción en Airtable.
    expect(describirCanal("Referido", "sobra")).toBe("Referido");
  });

  it("sin canal no inventa nada", () => {
    expect(describirCanal(null, "algo")).toBeNull();
    expect(describirCanal("Otro", null)).toBe("Otro");
  });
});
