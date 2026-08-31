import { describe, expect, it } from "vitest";

import { interpretarDictado, normalizar, sumarDias } from "@/lib/dictado";

/**
 * `dictado.ts` reparte un dictado libre en los campos del formulario de visita.
 * Es la pieza más frágil del proyecto: puro reconocimiento de patrones, donde
 * un cambio en una expresión regular rompe el reparto en silencio.
 */

const HOY = "2026-08-27"; // jueves

/**
 * Catálogo y clientes inventados: no van nombres de clientes ni productos
 * reales en el código fuente. Los códigos usan el rango 9000 para que no se
 * confundan con los de Sirius Product Core.
 */
const PRODUCTOS = [
  { codigo: "SIRIUS-PRODUCT-9001", nombre: "Alfaverde" },
  { codigo: "SIRIUS-PRODUCT-9002", nombre: "Betasuelo" },
  { codigo: "SIRIUS-PRODUCT-9003", nombre: "Gamaraiz" },
];
const CLIENTES = ["Agrícola Ejemplo", "Ficticia SAS", "Hacienda Modelo"];

const leer = (texto: string) =>
  interpretarDictado(texto, {
    productos: PRODUCTOS,
    clientes: CLIENTES,
    hoy: HOY,
  });

describe("normalizar", () => {
  it("baja a minúsculas y quita tildes", () => {
    expect(normalizar("Cotización ENVIADA a Agrícola Ejemplo")).toBe(
      "cotizacion enviada a agricola ejemplo",
    );
  });

  it("convierte la eñe a n, para que 'mañana' y 'manana' coincidan igual", () => {
    // Whisper transcribe de las dos formas y los patrones buscan "manana".
    expect(normalizar("MAÑANA")).toBe("manana");
    expect(normalizar("Pasado Mañana")).toBe("pasado manana");
  });
});

describe("sumarDias", () => {
  it("cruza fin de mes", () => {
    expect(sumarDias("2026-08-27", 5)).toBe("2026-09-01");
  });

  it("cruza fin de año", () => {
    expect(sumarDias("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("maneja el 29 de febrero de un año bisiesto", () => {
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(sumarDias("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("resta con días negativos", () => {
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("marcadores de campo", () => {
  it("reparte cada campo cuando se nombra en voz alta", () => {
    const r = leer(
      "El objetivo es presentar la línea de bioinsumos. " +
        "La necesidad es controlar plaga en palma. " +
        "La próxima acción es enviar cotización. " +
        "Las observaciones son que el pago quedó a 60 días.",
    );

    // El módulo capitaliza y puntúa cada segmento, así que se compara en bajas.
    expect(r.objetivo.toLowerCase()).toContain("presentar la línea de bioinsumos");
    expect(r.necesidad.toLowerCase()).toContain("controlar plaga");
    expect(r.proximaAccion.toLowerCase()).toContain("enviar cotización");
    expect(r.observaciones.toLowerCase()).toContain("60 días");
  });

  it("acepta 'compromiso' como próxima acción y 'diagnóstico' como necesidad", () => {
    const r = leer(
      "El diagnóstico es suelo compactado. El compromiso es volver con el técnico.",
    );
    expect(r.necesidad.toLowerCase()).toContain("suelo compactado");
    expect(r.proximaAccion.toLowerCase()).toContain("volver con el técnico");
  });

  it("no mete el texto de un campo en otro", () => {
    const r = leer(
      "El objetivo es revisar resultados. Las observaciones son que llovió.",
    );
    expect(r.objetivo.toLowerCase()).not.toContain("llovió");
    expect(r.observaciones.toLowerCase()).not.toContain("revisar resultados");
  });
});

describe("tipo de visita", () => {
  /**
   * Una frase por cada alternativa de la expresión regular, y solo esa señal.
   * Si se prueban juntas ("videollamada por Teams"), romper una alternativa
   * pasa desapercibido porque la otra sigue coincidiendo.
   */
  it.each([
    // Virtual
    ["Fue una videollamada", "Virtual"],
    ["La reunión fue virtual", "Virtual"],
    ["Lo hablamos por Teams", "Virtual"],
    ["Nos vimos por Meet", "Virtual"],
    ["Lo atendí por Zoom", "Virtual"],
    ["Hicimos una videoconferencia", "Virtual"],
    // Llamada
    ["Fue una llamada corta", "Llamada"],
    ["Fue contacto telefónico", "Llamada"],
    ["Hablamos por teléfono", "Llamada"],
    ["Le marqué en la mañana", "Llamada"],
    // Presencial
    ["Fue presencial", "Presencial"],
    ["Nos vimos en campo", "Presencial"],
    ["Fue en la finca", "Presencial"],
    ["Fue en la planta", "Presencial"],
    ["Visitamos el lote", "Presencial"],
    ["Fuimos al cultivo", "Presencial"],
    ["Estuve con el ingeniero", "Presencial"],
    ["Estuvimos con el jefe de sanidad", "Presencial"],
  ])("reconoce %j como %s", (texto, esperado) => {
    expect(leer(texto).tipo).toBe(esperado);
  });

  it("lo virtual le gana a lo presencial si se dicen las dos", () => {
    // El orden de los if lo decide; queda documentado a propósito.
    expect(leer("Estuve en la finca y luego videollamada").tipo).toBe("Virtual");
  });

  it("deja el tipo en null si no hay señal", () => {
    expect(leer("Revisamos el cultivo").tipo).toBeNull();
  });
});

describe("resultado", () => {
  // Igual que con el tipo: una frase por alternativa, aislada.
  it.each([
    // Venta cerrada
    ["Fue venta cerrada", "Venta cerrada"],
    ["Cerramos la venta", "Venta cerrada"],
    ["Cerró la venta ayer", "Venta cerrada"],
    ["Nos compró 200 litros", "Venta cerrada"],
    ["Confirmó el pedido", "Venta cerrada"],
    // Cotización enviada
    ["Cotización enviada", "Cotización enviada"],
    ["Ya envié la cotización", "Cotización enviada"],
    ["Enviamos la cotización", "Cotización enviada"],
    ["Ya tiene la cotización", "Cotización enviada"],
    // Sin interés
    ["Quedó sin interés", "Sin interés por ahora"],
    ["No le interesa", "Sin interés por ahora"],
    ["No les interesa", "Sin interés por ahora"],
    ["No está interesado", "Sin interés por ahora"],
    ["No quiere por ahora", "Sin interés por ahora"],
    ["Nos dijo que no", "Sin interés por ahora"],
    // Interesado
    ["Quedó muy interesado", "Interesado"],
    ["Quedó interesado", "Interesado"],
    ["Le interesó el producto", "Interesado"],
    ["Mostró interés", "Interesado"],
    ["Está interesado", "Interesado"],
    // Seguimiento pendiente
    ["Requiere seguimiento", "Seguimiento pendiente"],
    ["Hay que volver a pasar", "Seguimiento pendiente"],
    ["Quedamos en revisar el lote", "Seguimiento pendiente"],
    ["Quedé en volver con el técnico", "Seguimiento pendiente"],
    ["Quedó en mandarme los datos", "Seguimiento pendiente"],
    ["Está pendiente la respuesta", "Seguimiento pendiente"],
  ])("reconoce %j como %s", (texto, esperado) => {
    expect(leer(texto).resultado).toBe(esperado);
  });

  it("deja el resultado en null si no hay señal", () => {
    expect(leer("Revisamos el lote sembrado").resultado).toBeNull();
  });
});

describe("productos", () => {
  it("devuelve los códigos de los productos nombrados", () => {
    const r = leer("Les presenté Alfaverde y Betasuelo");
    expect(r.productos).toContain("SIRIUS-PRODUCT-9001");
    expect(r.productos).toContain("SIRIUS-PRODUCT-9002");
    expect(r.productos).not.toContain("SIRIUS-PRODUCT-9003");
  });

  it("reconoce el producto sin importar tildes ni mayúsculas", () => {
    expect(leer("hablamos de GAMARAIZ").productos).toContain(
      "SIRIUS-PRODUCT-9003",
    );
  });

  it("no inventa productos que no se nombraron", () => {
    expect(leer("Revisamos el lote sembrado").productos).toEqual([]);
  });
});

describe("cliente", () => {
  it("reconoce un cliente de la lista", () => {
    expect(leer("Estuve en Hacienda Modelo revisando el cultivo").cliente).toBe(
      "Hacienda Modelo",
    );
  });

  it("devuelve null si no se nombró ninguno", () => {
    expect(leer("Estuve en una finca nueva").cliente).toBeNull();
  });
});

describe("fecha de seguimiento", () => {
  it("entiende 'en N días' y 'en N semanas'", () => {
    expect(leer("Volvemos en 5 días").fechaSeguimiento).toBe("2026-09-01");
    expect(leer("Volvemos en dos semanas").fechaSeguimiento).toBe("2026-09-10");
  });

  it("entiende 'la próxima semana'", () => {
    // Cae después de hoy, sea el día exacto que sea.
    const fecha = leer("Lo revisamos la próxima semana").fechaSeguimiento;
    expect(fecha).not.toBeNull();
    expect(fecha! > HOY).toBe(true);
  });

  it("entiende una fecha explícita", () => {
    expect(leer("La fecha del seguimiento es el 30 de agosto").fechaSeguimiento)
      .toBe("2026-08-30");
  });

  it("la fecha rotulada le gana a una relativa dicha antes", () => {
    // El comentario del código lo dice: "la otra semana" en el objetivo no
    // debe ganarle a "el 30 de agosto" en el campo de fecha.
    const r = leer(
      "El objetivo es cerrar la otra semana. " +
        "La fecha del próximo seguimiento es el 30 de agosto.",
    );
    expect(r.fechaSeguimiento).toBe("2026-08-30");
  });

  it("deja la fecha en null si no se dijo ninguna", () => {
    expect(leer("Presenté el portafolio").fechaSeguimiento).toBeNull();
  });
});

describe("dictado realista completo", () => {
  it("reparte un dictado como el del ejemplo del formulario", () => {
    const r = leer(
      "Estuve presencial en Hacienda Modelo, necesitan controlar plaga, " +
        "les presenté Betasuelo, quedamos en enviar cotización la próxima semana",
    );

    expect(r.tipo).toBe("Presencial");
    expect(r.cliente).toBe("Hacienda Modelo");
    expect(r.productos).toContain("SIRIUS-PRODUCT-9002");
    expect(r.fechaSeguimiento).not.toBeNull();
    // Algo tuvo que quedar en los campos de texto, no todo vacío.
    expect(`${r.objetivo}${r.necesidad}${r.proximaAccion}`.length).toBeGreaterThan(
      0,
    );
  });

  it("no falla ni inventa con entradas vacías o basura", () => {
    for (const texto of ["", "   ", "aaa bbb ccc", "123 456"]) {
      const r = leer(texto);
      expect(r.productos).toEqual([]);
      expect(r.cliente).toBeNull();
      expect(r.fechaSeguimiento).toBeNull();
    }
  });
});

describe("pendientes", () => {
  it("reparte lo que se dicta como pendiente en su propio campo", () => {
    const lectura = interpretarDictado(
      "El objetivo fue presentar la línea. Los pendientes son enviar la ficha técnica y confirmar el precio.",
      { hoy: "2026-08-31" },
    );

    // El dictado capitaliza cada segmento, así que se compara en minúsculas.
    expect(lectura.objetivo.toLowerCase()).toContain("presentar la línea");
    expect(lectura.pendientes.toLowerCase()).toContain("enviar la ficha técnica");
    expect(lectura.pendientes.toLowerCase()).toContain("confirmar el precio");
  });

  it("no confunde «pendientes» con la próxima acción", () => {
    const lectura = interpretarDictado(
      "La próxima acción es enviar cotización. Los pendientes son revisar el lote 4.",
      { hoy: "2026-08-31" },
    );

    expect(lectura.proximaAccion.toLowerCase()).toContain("enviar cotización");
    expect(lectura.proximaAccion).not.toContain("lote 4");
    expect(lectura.pendientes.toLowerCase()).toContain("revisar el lote 4");
  });

  it("reconoce «quedó pendiente» además del rótulo con dos puntos", () => {
    const lectura = interpretarDictado(
      "Visita presencial. Quedó pendiente el acta de la prueba.",
      { hoy: "2026-08-31" },
    );

    expect(lectura.pendientes.toLowerCase()).toContain("acta de la prueba");
  });

  it("deja el campo vacío cuando nadie dictó pendientes", () => {
    const lectura = interpretarDictado("Visita presencial a Guaicaramo.", {
      hoy: "2026-08-31",
    });

    expect(lectura.pendientes).toBe("");
  });
});

describe("contacto", () => {
  const CONTACTOS = ["Federico Gómez", "María Alexandra Montoya", "Omaira Ortiz"];

  it("reconoce al contacto nombrado en el dictado", () => {
    const lectura = interpretarDictado(
      "Estuve con Federico Gómez revisando el lote.",
      { hoy: "2026-08-31", contactos: CONTACTOS },
    );

    expect(lectura.contacto).toBe("Federico Gómez");
  });

  it("lo reconoce aunque Whisper lo transcriba de oído", () => {
    const lectura = interpretarDictado("Hablé con Omaira Ortíz sobre el pedido.", {
      hoy: "2026-08-31",
      contactos: CONTACTOS,
    });

    expect(lectura.contacto).toBe("Omaira Ortiz");
  });

  it("no inventa un contacto cuando nadie lo nombró", () => {
    const lectura = interpretarDictado("Visita presencial de seguimiento.", {
      hoy: "2026-08-31",
      contactos: CONTACTOS,
    });

    expect(lectura.contacto).toBeNull();
  });

  it("sin lista de contactos no devuelve nada", () => {
    const lectura = interpretarDictado("Estuve con Federico Gómez.", {
      hoy: "2026-08-31",
    });

    expect(lectura.contacto).toBeNull();
  });

  it("sigue detectando el cliente con la misma búsqueda", () => {
    // `detectarNombre` ahora sirve a los dos; el cliente no debe haberse roto.
    const lectura = interpretarDictado("Visita a Guaicaramo S.A.S.", {
      hoy: "2026-08-31",
      clientes: ["Guaicaramo S.A.S."],
      contactos: CONTACTOS,
    });

    expect(lectura.cliente).toBe("Guaicaramo S.A.S.");
    expect(lectura.contacto).toBeNull();
  });
});
