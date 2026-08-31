import { describe, expect, it } from "vitest";

import {
  esErrorVisita,
  revisarVisita,
  type CamposVisita,
} from "@/lib/crm-comun";

/** Una visita que pasa todas las reglas; cada prueba rompe solo una cosa. */
const VALIDA: CamposVisita = {
  fecha: "2026-08-31",
  objetivo: "Presentar la línea de bioinsumos",
  tipo: "Presencial",
  resultado: "Interesado",
  proximaAccion: null,
  fechaSeguimiento: null,
};

function error(campos: Partial<CamposVisita>): string | null {
  const revisada = revisarVisita({ ...VALIDA, ...campos });
  return esErrorVisita(revisada) ? revisada.error : null;
}

describe("revisarVisita", () => {
  it("acepta una visita completa y devuelve los campos ya estrechados", () => {
    const revisada = revisarVisita(VALIDA);

    expect(esErrorVisita(revisada)).toBe(false);
    if (esErrorVisita(revisada)) return;
    expect(revisada.datos.tipo).toBe("Presencial");
    expect(revisada.datos.resultado).toBe("Interesado");
  });

  it("exige fecha con formato de día completo", () => {
    expect(error({ fecha: null })).toMatch(/fecha de la visita/i);
    expect(error({ fecha: "31/08/2026" })).toMatch(/fecha de la visita/i);
    expect(error({ fecha: "2026-08" })).toMatch(/fecha de la visita/i);
  });

  it("exige objetivo", () => {
    expect(error({ objetivo: null })).toMatch(/objetivo/i);
  });

  it("rechaza tipos y resultados que no están en las listas", () => {
    expect(error({ tipo: "Videollamada" })).toMatch(/tipo/i);
    expect(error({ resultado: "Vendido" })).toMatch(/resultado/i);
  });

  it("no deja agendar un seguimiento sin decir qué se va a hacer", () => {
    expect(
      error({ fechaSeguimiento: "2026-09-15", proximaAccion: null }),
    ).toMatch(/próxima acción/i);
  });

  it("con «Seguimiento pendiente» exige la fecha del compromiso", () => {
    expect(
      error({
        resultado: "Seguimiento pendiente",
        proximaAccion: "Enviar cotización",
        fechaSeguimiento: null,
      }),
    ).toMatch(/próximo seguimiento/i);
  });

  it("acepta el par completo: acción y fecha", () => {
    expect(
      error({
        resultado: "Seguimiento pendiente",
        proximaAccion: "Enviar cotización",
        fechaSeguimiento: "2026-09-15",
      }),
    ).toBeNull();
  });

  it("valida el formato de la fecha de seguimiento, no solo su presencia", () => {
    expect(
      error({
        proximaAccion: "Enviar cotización",
        fechaSeguimiento: "15-09-2026",
      }),
    ).toMatch(/fecha de seguimiento/i);
  });
});
