/**
 * El conector MCP (`mcp/opciones.mjs`) copia las listas de opciones porque
 * corre en Node plano, sin TypeScript ni el alias `@/`. Una copia se desfasa en
 * silencio: el día que alguien agregue un estado de pedido en Airtable y solo
 * lo sume aquí, el conector seguiría ofreciendo la lista vieja y rechazando un
 * valor válido antes de que el CRM lo viera. Esta prueba es lo que lo impide.
 */

import { describe, expect, it } from "vitest";

import {
  ESTADOS_CASO,
  TIPOS_CASO,
  TIPOS_CASO_ANTERIORES,
  TIPOS_PQRSF,
} from "@/lib/casos-comun";
import {
  ESTADOS_COTIZACION,
  ESTADOS_INICIALES_COTIZACION,
  estaCerradaCotizacion,
  FORMAS_PAGO,
  MODALIDADES_ENTREGA,
} from "@/lib/cotizaciones-comun";
import { RESULTADOS_VISITA, TIPOS_VISITA } from "@/lib/crm-comun";
import {
  CATEGORIAS_APLICACION,
  ESTADOS_PEDIDO,
  estaCerradoPedido,
} from "@/lib/pedidos-comun";

import * as mcp from "../../mcp/opciones.mjs";

describe("las opciones del conector MCP", () => {
  it("replican las de Visitas", () => {
    expect(mcp.TIPOS_VISITA).toEqual([...TIPOS_VISITA]);
    expect(mcp.RESULTADOS_VISITA).toEqual([...RESULTADOS_VISITA]);
  });

  it("replican las de Casos", () => {
    expect(mcp.TIPOS_PQRSF).toEqual([...TIPOS_PQRSF]);
    expect(mcp.TIPOS_CASO_ANTERIORES).toEqual([...TIPOS_CASO_ANTERIORES]);
    expect(mcp.TIPOS_CASO).toEqual([...TIPOS_CASO]);
    expect(mcp.ESTADOS_CASO).toEqual([...ESTADOS_CASO]);
  });

  it("replican las de Pedidos", () => {
    expect(mcp.ESTADOS_PEDIDO).toEqual([...ESTADOS_PEDIDO]);
    expect(mcp.CATEGORIAS_APLICACION).toEqual([...CATEGORIAS_APLICACION]);
  });

  it("replican las de Cotizaciones", () => {
    expect(mcp.ESTADOS_COTIZACION).toEqual([...ESTADOS_COTIZACION]);
    expect(mcp.ESTADOS_COTIZACION_INICIALES).toEqual([
      ...ESTADOS_INICIALES_COTIZACION,
    ]);
    expect(mcp.MODALIDADES_ENTREGA).toEqual([...MODALIDADES_ENTREGA]);
    expect(mcp.FORMAS_PAGO).toEqual([...FORMAS_PAGO]);
  });

  it("coinciden con qué estado de cotización está cerrado", () => {
    for (const estado of ESTADOS_COTIZACION) {
      expect(mcp.ESTADOS_COTIZACION_CERRADOS.includes(estado)).toBe(
        estaCerradaCotizacion(estado),
      );
    }
  });

  it("coinciden con qué estado de pedido está cerrado", () => {
    for (const estado of ESTADOS_PEDIDO) {
      expect(mcp.ESTADOS_PEDIDO_CERRADOS.includes(estado)).toBe(
        estaCerradoPedido(estado),
      );
    }
  });
});
