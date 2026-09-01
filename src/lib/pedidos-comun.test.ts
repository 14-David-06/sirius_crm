import { describe, expect, it } from "vitest";

import {
  coincidePedido,
  FILTROS_PEDIDO_VACIOS,
  type FiltrosPedido,
  type PedidoFiltrable,
} from "@/lib/pedidos-comun";

function pedido(cambios: Partial<PedidoFiltrable> = {}): PedidoFiltrable {
  return {
    id: "SIRIUS-PED-0001",
    cliente: "Guaicaramo",
    estado: "Recibido",
    fecha: "2026-08-15",
    notas: null,
    responsable: "Ana Bleier",
    lineas: [{ producto: "Biochar Blend" }],
    remisiones: [],
    ...cambios,
  };
}

function pasa(
  cambios: Partial<PedidoFiltrable>,
  filtros: Partial<FiltrosPedido>,
): boolean {
  return coincidePedido(pedido(cambios), {
    ...FILTROS_PEDIDO_VACIOS,
    ...filtros,
  });
}

describe("coincidePedido · producto", () => {
  it("encuentra el producto aunque sea uno de varios renglones", () => {
    expect(
      pasa(
        {
          lineas: [{ producto: "Biochar Blend" }, { producto: "Sirius Bacter" }],
        },
        { producto: "Sirius Bacter" },
      ),
    ).toBe(true);
  });

  it("descarta el pedido que no lo lleva", () => {
    expect(pasa({}, { producto: "Sirius Bacter" })).toBe(false);
  });

  it("sin filtro de producto no descarta nada", () => {
    expect(pasa({ lineas: [] }, {})).toBe(true);
  });
});

describe("coincidePedido · responsable", () => {
  it("filtra por el nombre exacto", () => {
    expect(pasa({}, { responsable: "Ana Bleier" })).toBe(true);
    expect(pasa({}, { responsable: "Otra Persona" })).toBe(false);
  });

  it("descarta un pedido sin responsable cuando se pide uno", () => {
    expect(pasa({ responsable: null }, { responsable: "Ana Bleier" })).toBe(
      false,
    );
  });
});

describe("coincidePedido · rango de fechas", () => {
  it("incluye los extremos del rango", () => {
    expect(pasa({ fecha: "2026-08-15" }, { desde: "2026-08-15" })).toBe(true);
    expect(pasa({ fecha: "2026-08-15" }, { hasta: "2026-08-15" })).toBe(true);
  });

  it("deja fuera lo anterior y lo posterior", () => {
    expect(pasa({ fecha: "2026-08-14" }, { desde: "2026-08-15" })).toBe(false);
    expect(pasa({ fecha: "2026-08-16" }, { hasta: "2026-08-15" })).toBe(false);
  });

  it("aplica los dos extremos a la vez", () => {
    const rango = { desde: "2026-08-01", hasta: "2026-08-31" };
    expect(pasa({ fecha: "2026-08-15" }, rango)).toBe(true);
    expect(pasa({ fecha: "2026-07-31" }, rango)).toBe(false);
    expect(pasa({ fecha: "2026-09-01" }, rango)).toBe(false);
  });

  it("un pedido sin fecha sale en cuanto se pide un rango", () => {
    // No se puede afirmar que esté dentro, así que no se afirma.
    expect(pasa({ fecha: null }, { desde: "2026-08-01" })).toBe(false);
    expect(pasa({ fecha: null }, { hasta: "2026-08-31" })).toBe(false);
    expect(pasa({ fecha: null }, {})).toBe(true);
  });

  it("un rango invertido no devuelve nada, en vez de ignorarse", () => {
    expect(
      pasa({ fecha: "2026-08-15" }, { desde: "2026-09-01", hasta: "2026-08-01" }),
    ).toBe(false);
  });
});

describe("coincidePedido · combinación", () => {
  it("exige que se cumplan todos los filtros a la vez", () => {
    const filtros = {
      estado: "todos",
      cliente: "Guaicaramo",
      producto: "Biochar Blend",
      responsable: "Ana Bleier",
      desde: "2026-08-01",
      hasta: "2026-08-31",
    };
    expect(pasa({}, filtros)).toBe(true);
    // Basta con que uno falle.
    expect(pasa({ cliente: "Otra Finca" }, filtros)).toBe(false);
  });

  it("los filtros nuevos conviven con el de estado", () => {
    expect(
      pasa({ estado: "Completado" }, { producto: "Biochar Blend" }),
    ).toBe(false); // "abiertos" es el estado por defecto
    expect(
      pasa(
        { estado: "Completado" },
        { estado: "todos", producto: "Biochar Blend" },
      ),
    ).toBe(true);
  });

  it("el texto libre sigue buscando en producto y responsable", () => {
    expect(pasa({}, { termino: "bacter" })).toBe(false);
    expect(pasa({}, { termino: "biochar" })).toBe(true);
    expect(pasa({}, { termino: "ana" })).toBe(true);
  });
});
