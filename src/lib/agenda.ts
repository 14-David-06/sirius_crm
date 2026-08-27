import { listarCasosPendientes } from "@/lib/casos";
import { hoyEnBogota, listarVisitas } from "@/lib/crm";

/**
 * Agenda del home: reúne en una sola lista los compromisos con fecha que hoy
 * viven en dos tablas distintas — el seguimiento pactado en una visita y la
 * fecha límite de un caso abierto.
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

export type Agenda = {
  pendientes: Pendiente[];
  /** Hoy en Bogotá: lo calcula el servidor para que no dependa del reloj del navegador. */
  hoy: string;
  /** True si Airtable no respondió; la vista lo dice en vez de fingir cero pendientes. */
  error: boolean;
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

export async function cargarAgenda(): Promise<Agenda> {
  const hoy = hoyEnBogota();

  try {
    const [visitas, casos] = await Promise.all([
      listarVisitas(),
      listarCasosPendientes(),
    ]);

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
      if (!fecha) return [];

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

    const pendientes = [...deVisitas, ...deCasos].sort(
      (a, b) => a.fecha.localeCompare(b.fecha) || a.cliente.localeCompare(b.cliente, "es"),
    );

    return { pendientes, hoy, error: false };
  } catch (error) {
    console.error("cargar agenda", error);
    return { pendientes: [], hoy, error: true };
  }
}
