import { describe, expect, it } from "vitest";

import {
  coincideCotizacion,
  estaVencidaPorFecha,
  FILTROS_COTIZACION_VACIOS,
  formatearRevision,
  formatearVigencia,
  leerSerialCotizacion,
  serialCotizacion,
  siguientesEstadosCotizacion,
  totalesDe,
  vencimientoDe,
  type CotizacionFiltrable,
  type FiltrosCotizacion,
} from "@/lib/cotizaciones-comun";

/* -------------------------------- Vigencia ------------------------------- */

describe("vencimientoDe", () => {
  it("suma los días de vigencia a la emisión", () => {
    expect(vencimientoDe("2026-09-03", 30)).toBe("2026-10-03");
  });

  it("cruza el fin de año sin perderse", () => {
    expect(vencimientoDe("2026-12-20", 30)).toBe("2027-01-19");
  });

  it("cuenta el 29 de febrero en año bisiesto", () => {
    expect(vencimientoDe("2028-02-01", 30)).toBe("2028-03-02");
  });

  it("no inventa un vencimiento sin emisión o sin vigencia", () => {
    expect(vencimientoDe(null, 30)).toBeNull();
    expect(vencimientoDe("2026-09-03", null)).toBeNull();
  });
});

describe("estaVencidaPorFecha", () => {
  it("el día del vencimiento todavía está vigente", () => {
    expect(estaVencidaPorFecha("2026-09-03", 30, "2026-10-03")).toBe(false);
  });

  it("el día siguiente ya está vencida", () => {
    expect(estaVencidaPorFecha("2026-09-03", 30, "2026-10-04")).toBe(true);
  });

  it("a una oferta incompleta no se le afirma que está vencida", () => {
    expect(estaVencidaPorFecha(null, 30, "2027-01-01")).toBe(false);
    expect(estaVencidaPorFecha("2026-09-03", null, "2027-01-01")).toBe(false);
  });
});

/* -------------------------------- Totales -------------------------------- */

describe("totalesDe", () => {
  const lineas = [
    { cantidad: 20, precioUnitario: 45_000 },
    { cantidad: 20, precioUnitario: 45_000 },
  ];

  it("suma los renglones", () => {
    expect(totalesDe(lineas, null).subtotal).toBe(1_800_000);
  });

  it("con IVA por confirmar no asume cero: el IVA queda nulo", () => {
    const totales = totalesDe(lineas, null);
    expect(totales.iva).toBeNull();
    expect(totales.total).toBe(1_800_000);
  });

  it("un IVA de 0 % es distinto de un IVA por confirmar", () => {
    expect(totalesDe(lineas, 0).iva).toBe(0);
  });

  it("calcula el IVA y lo suma", () => {
    const totales = totalesDe(lineas, 19);
    expect(totales.iva).toBe(342_000);
    expect(totales.total).toBe(2_142_000);
  });

  it("redondea el IVA, que es la cifra que va en la factura", () => {
    expect(totalesDe([{ cantidad: 1, precioUnitario: 1_001 }], 19).iva).toBe(190);
  });

  it("una oferta sin renglones vale cero, no NaN", () => {
    expect(totalesDe([], 19)).toEqual({ subtotal: 0, iva: 0, total: 0 });
  });
});

/* ------------------------------ Consecutivo ------------------------------ */

describe("el consecutivo controlado", () => {
  it("se escribe con tres dígitos", () => {
    expect(serialCotizacion(2026, 4)).toBe("COT-2026-004");
  });

  it("crece en vez de truncarse pasando de 999", () => {
    expect(serialCotizacion(2026, 1_000)).toBe("COT-2026-1000");
  });

  it("se puede volver a leer", () => {
    expect(leerSerialCotizacion("COT-2026-004")).toEqual({
      anio: 2026,
      consecutivo: 4,
    });
  });

  it("no reconoce lo que no tiene esa forma", () => {
    expect(leerSerialCotizacion("SIRIUS-PED-0001")).toBeNull();
    expect(leerSerialCotizacion(null)).toBeNull();
  });

  it("lee de vuelta lo que escribió, incluso pasando de 999", () => {
    for (const consecutivo of [1, 4, 99, 999, 1_000]) {
      expect(leerSerialCotizacion(serialCotizacion(2026, consecutivo))).toEqual({
        anio: 2026,
        consecutivo,
      });
    }
  });
});

describe("formatearRevision", () => {
  it("imprime la revisión con dos dígitos", () => {
    expect(formatearRevision(0)).toBe("Rev. 00");
    expect(formatearRevision(3)).toBe("Rev. 03");
  });

  it("sin revisión asume la primera", () => {
    expect(formatearRevision(null)).toBe("Rev. 00");
  });
});

describe("formatearVigencia", () => {
  it("dice los días y hasta cuándo", () => {
    expect(formatearVigencia("2026-09-03", 30)).toBe(
      "30 días · hasta el 3 de octubre de 2026",
    );
  });

  it("concuerda en singular", () => {
    expect(formatearVigencia("2026-09-03", 1)).toBe(
      "1 día · hasta el 4 de septiembre de 2026",
    );
  });

  it("sin vigencia no promete nada", () => {
    expect(formatearVigencia("2026-09-03", null)).toBe("Por definir");
  });
});

/* ---------------------------- Estados y saltos --------------------------- */

describe("siguientesEstadosCotizacion", () => {
  it("un borrador se envía o se anula, pero no se acepta", () => {
    expect(siguientesEstadosCotizacion("Borrador")).toEqual([
      "Enviada",
      "Anulada",
    ]);
  });

  it("una enviada es la única que el cliente puede aceptar o rechazar", () => {
    expect(siguientesEstadosCotizacion("Enviada")).toContain("Aceptada");
    expect(siguientesEstadosCotizacion("Enviada")).toContain("Rechazada");
  });

  it("una cerrada no se mueve: para cambiar algo se emite una revisión", () => {
    for (const estado of ["Aceptada", "Rechazada", "Vencida", "Anulada"]) {
      expect(siguientesEstadosCotizacion(estado)).toEqual([]);
    }
  });

  it("sin estado no ofrece saltos", () => {
    expect(siguientesEstadosCotizacion(null)).toEqual([]);
  });
});

/* -------------------------------- Filtros -------------------------------- */

function cotizacion(
  cambios: Partial<CotizacionFiltrable> = {},
): CotizacionFiltrable {
  return {
    id: "COT-2026-004",
    cliente: "Sapuga S.A.",
    titulo: "Microbiología agrícola",
    estado: "Enviada",
    fechaEmision: "2026-09-03",
    responsable: "Angélica María Herrera",
    observaciones: null,
    notasInternas: null,
    lineas: [{ producto: "Siriusbacter" }],
    vencida: false,
    ...cambios,
  };
}

function pasa(
  cambios: Partial<CotizacionFiltrable>,
  filtros: Partial<FiltrosCotizacion>,
): boolean {
  return coincideCotizacion(cotizacion(cambios), {
    ...FILTROS_COTIZACION_VACIOS,
    ...filtros,
  });
}

describe("coincideCotizacion · texto", () => {
  it("busca por consecutivo", () => {
    expect(pasa({}, { termino: "cot-2026-004" })).toBe(true);
  });

  it("busca por título", () => {
    expect(pasa({}, { termino: "microbiología" })).toBe(true);
  });

  it("encuentra el producto aunque sea uno de varios renglones", () => {
    expect(
      pasa(
        { lineas: [{ producto: "Siriusbacter" }, { producto: "Trichoderma" }] },
        { termino: "trichoderma" },
      ),
    ).toBe(true);
  });

  it("no encuentra lo que no está", () => {
    expect(pasa({}, { termino: "biochar" })).toBe(false);
  });
});

describe("coincideCotizacion · estado", () => {
  it("por defecto muestra las abiertas", () => {
    expect(pasa({ estado: "Enviada" }, {})).toBe(true);
    expect(pasa({ estado: "Aceptada" }, {})).toBe(false);
  });

  it("«cerradas» deja solo las que ya se decidieron", () => {
    expect(pasa({ estado: "Rechazada" }, { estado: "cerradas" })).toBe(true);
    expect(pasa({ estado: "Borrador" }, { estado: "cerradas" })).toBe(false);
  });

  it("«por-vencer» persigue las que pasaron su vigencia y nadie cerró", () => {
    expect(
      pasa({ estado: "Enviada", vencida: true }, { estado: "por-vencer" }),
    ).toBe(true);
  });

  it("una vigente no aparece entre las vencidas", () => {
    expect(
      pasa({ estado: "Enviada", vencida: false }, { estado: "por-vencer" }),
    ).toBe(false);
  });

  it("una ya cerrada tampoco: ya no hay nada que perseguir", () => {
    expect(
      pasa({ estado: "Aceptada", vencida: true }, { estado: "por-vencer" }),
    ).toBe(false);
  });

  it("un estado concreto filtra por él", () => {
    expect(pasa({ estado: "Borrador" }, { estado: "Borrador" })).toBe(true);
    expect(pasa({ estado: "Enviada" }, { estado: "Borrador" })).toBe(false);
  });

  it("«todos» no descarta nada por estado", () => {
    expect(pasa({ estado: "Anulada" }, { estado: "todos" })).toBe(true);
  });
});

describe("coincideCotizacion · fechas", () => {
  it("respeta el rango inclusive en los dos extremos", () => {
    expect(pasa({}, { desde: "2026-09-03", hasta: "2026-09-03" })).toBe(true);
  });

  it("descarta lo que queda fuera", () => {
    expect(pasa({}, { desde: "2026-09-04" })).toBe(false);
    expect(pasa({}, { hasta: "2026-09-02" })).toBe(false);
  });

  it("una oferta sin fecha sale en cuanto se pide un rango", () => {
    expect(pasa({ fechaEmision: null }, { desde: "2026-01-01" })).toBe(false);
  });

  it("pero sin rango sigue apareciendo", () => {
    expect(pasa({ fechaEmision: null }, {})).toBe(true);
  });

  it("un rango invertido no deja pasar nada", () => {
    expect(pasa({}, { desde: "2026-10-01", hasta: "2026-08-01" })).toBe(false);
  });
});

describe("coincideCotizacion · cliente, producto y responsable", () => {
  it("filtra por cliente exacto", () => {
    expect(pasa({}, { cliente: "Sapuga S.A." })).toBe(true);
    expect(pasa({}, { cliente: "Guaicaramo" })).toBe(false);
  });

  it("filtra por un producto que está en algún renglón", () => {
    expect(
      pasa(
        { lineas: [{ producto: "Siriusbacter" }, { producto: "Trichoderma" }] },
        { producto: "Trichoderma" },
      ),
    ).toBe(true);
  });

  it("filtra por responsable", () => {
    expect(pasa({}, { responsable: "Angélica María Herrera" })).toBe(true);
    expect(pasa({ responsable: null }, { responsable: "Ana Bleier" })).toBe(
      false,
    );
  });

  it("acumula los filtros: todos tienen que pasar", () => {
    expect(pasa({}, { cliente: "Sapuga S.A.", producto: "Trichoderma" })).toBe(
      false,
    );
  });
});
