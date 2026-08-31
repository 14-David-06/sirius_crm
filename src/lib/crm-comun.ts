/**
 * Lo que de Visitas comparten el cliente y el servidor. Vive aparte de
 * `crm.ts` para que los formularios `"use client"` no arrastren la capa de
 * Airtable al bundle del navegador.
 */

export const TIPOS_VISITA = ["Presencial", "Virtual", "Llamada"] as const;

export const RESULTADOS_VISITA = [
  "Interesado",
  "Cotización enviada",
  "Venta cerrada",
  "Seguimiento pendiente",
  "Sin interés por ahora",
] as const;

export type TipoVisita = (typeof TIPOS_VISITA)[number];
export type ResultadoVisita = (typeof RESULTADOS_VISITA)[number];
export type EstadoSeguimiento = "Atrasado" | "Hoy" | "Programado" | null;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Lo que llega del formulario, sin revisar todavía. */
export type CamposVisita = {
  fecha: string | null;
  objetivo: string | null;
  tipo: string | null;
  resultado: string | null;
  proximaAccion: string | null;
  fechaSeguimiento: string | null;
};

/** Los mismos campos ya revisados: lo obligatorio dejó de poder ser null. */
export type VisitaValidada = {
  fecha: string;
  objetivo: string;
  tipo: TipoVisita;
  resultado: ResultadoVisita;
  proximaAccion: string | null;
  fechaSeguimiento: string | null;
};

/**
 * Revisa una visita y devuelve o el mensaje del primer problema, o los campos
 * con el tipo ya estrechado.
 *
 * Vive aquí y no en la ruta porque las reglas son las mismas al registrar y al
 * editar: escritas dos veces, tarde o temprano una quedaría atrás. Devolver
 * los datos en vez de solo validar es lo que le ahorra a quien llama los
 * `as TipoVisita` que no comprueban nada — el mismo patrón de `autoria.ts`.
 */
export function revisarVisita(
  campos: CamposVisita,
): { error: string } | { datos: VisitaValidada } {
  const { fecha, objetivo, tipo, resultado, proximaAccion, fechaSeguimiento } =
    campos;

  if (!fecha || !FECHA.test(fecha)) {
    return { error: "La fecha de la visita es obligatoria." };
  }
  if (!objetivo) {
    return { error: "Describe el objetivo de la visita." };
  }
  if (!tipo || !esTipo(tipo)) {
    return { error: "Tipo de visita inválido." };
  }
  if (!resultado || !esResultado(resultado)) {
    return { error: "Resultado inválido." };
  }
  if (fechaSeguimiento && !FECHA.test(fechaSeguimiento)) {
    return { error: "Fecha de seguimiento inválida." };
  }
  // Las dos reglas del archivo de Excel del equipo: un seguimiento agendado
  // sin acción no le dice nada a quien lo abre, y un resultado que dice que
  // queda seguimiento tiene que traer la fecha.
  if (fechaSeguimiento && !proximaAccion) {
    return { error: "Si agendas un seguimiento, escribe la próxima acción." };
  }
  if (resultado === "Seguimiento pendiente" && !fechaSeguimiento) {
    return {
      error:
        "Con resultado 'Seguimiento pendiente' debes fijar la fecha del próximo seguimiento.",
    };
  }

  return {
    datos: {
      fecha,
      objetivo,
      tipo,
      resultado,
      proximaAccion,
      fechaSeguimiento,
    },
  };
}

export function esErrorVisita(
  valor: { error: string } | { datos: VisitaValidada },
): valor is { error: string } {
  return "error" in valor;
}

function esTipo(valor: string): valor is TipoVisita {
  return TIPOS_VISITA.includes(valor as TipoVisita);
}

function esResultado(valor: string): valor is ResultadoVisita {
  return RESULTADOS_VISITA.includes(valor as ResultadoVisita);
}
