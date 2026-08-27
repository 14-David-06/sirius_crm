import { estaCerrado, type Caso } from "@/lib/casos";
import type { Visita } from "@/lib/crm";

/**
 * Agenda del home: reúne en una sola lista los compromisos con fecha que
 * viven en dos tablas distintas — el seguimiento pactado en una visita y la
 * fecha límite de un caso abierto.
 *
 * Aquí solo se arma la lista; las lecturas de Airtable las hace
 * `cargarInicio` en `@/lib/inicio`, para no pedir las mismas tablas dos veces
 * en la misma página.
 */

export type TipoPendiente = "seguimiento" | "caso";
export type EstadoPendiente = "atrasado" | "hoy" | "proximo";

export type Pendiente = {
  id: string;
  recordId: string;
  tipo: TipoPendiente;
  /** YYYY-MM-DD, la misma forma que usa Airtable. */
  fecha: string;
  titulo: string;
  cliente: string;
  responsable: string | null;
  estado: EstadoPendiente;
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}/;

/** Airtable puede devolver la fecha con hora; el calendario solo usa el día. */
function soloDia(valor: string | null): string | null {
  const coincidencia = valor?.match(FECHA_ISO);
  return coincidencia ? coincidencia[0] : null;
}

export function estadoPorFecha(fecha: string, hoy: string): EstadoPendiente {
  if (fecha < hoy) return "atrasado";
  if (fecha === hoy) return "hoy";
  return "proximo";
}

export function armarPendientes(
  visitas: Visita[],
  casos: Caso[],
  hoy: string,
): Pendiente[] {
  const deVisitas: Pendiente[] = visitas.flatMap((visita) => {
    const fecha = soloDia(visita.fechaSeguimiento);
    if (!fecha) return [];

    return [
      {
        id: `visita-${visita.recordId}`,
        recordId: visita.recordId,
        tipo: "seguimiento",
        fecha,
        titulo: visita.proximaAccion?.trim() || "Seguimiento pendiente",
        cliente: visita.cliente,
        responsable: visita.responsable,
        estado: estadoPorFecha(fecha, hoy),
      },
    ];
  });

  const deCasos: Pendiente[] = casos.flatMap((caso) => {
    const fecha = soloDia(caso.fechaLimite);
    if (!fecha || estaCerrado(caso.estado)) return [];

    return [
      {
        id: `caso-${caso.recordId}`,
        recordId: caso.recordId,
        tipo: "caso",
        fecha,
        titulo: caso.descripcion?.trim() || caso.tipo?.trim() || "Caso abierto",
        cliente: caso.cliente,
        responsable: caso.responsable,
        estado: estadoPorFecha(fecha, hoy),
      },
    ];
  });

  return [...deVisitas, ...deCasos].sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) || a.cliente.localeCompare(b.cliente, "es"),
  );
}
