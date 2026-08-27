import { armarPendientes, type Pendiente } from "@/lib/agenda";
import { estaCerrado, listarCasos, type Caso } from "@/lib/casos";
import { listarClientesCompletos } from "@/lib/clientes";
import { hoyEnBogota, listarVisitas, type Visita } from "@/lib/crm";
import { esDeLaSesion, type Permisos } from "@/lib/permisos";

/**
 * Todo lo que el home muestra, calculado desde Airtable en una sola pasada.
 *
 * Lo que NO está aquí es deliberado: no hay tablas de pedidos, facturación ni
 * oportunidades, así que el home no habla de plata, de cuotas ni de pipeline.
 * Cuando exista la tabla de Oportunidades, el embudo comercial entra aquí.
 */

export type KpiInicio = {
  id: string;
  titulo: string;
  valor: string;
  detalle: string;
  /** null cuando no hay periodo anterior con el que comparar. */
  delta: number | null;
  /** Vacía cuando la métrica no tiene una serie de tiempo real detrás. */
  serie: number[];
  /** En "casos" o "atrasados", bajar es bueno. */
  bajarEsBueno?: boolean;
};

export type PuntoMes = { mes: string; etiqueta: string; visitas: number };

export type ResultadoVisitas = { resultado: string; cantidad: number };

export type ItemActividad = {
  id: string;
  tipo: string | null;
  titulo: string;
  cliente: string;
  responsable: string | null;
  fecha: string | null;
};

export type FilaSeguimiento = {
  id: string;
  recordId: string;
  cliente: string;
  tipo: string | null;
  responsable: string | null;
  accion: string;
  fecha: string;
  estado: "Atrasado" | "Hoy" | "Programado";
};

export type ClienteActivo = {
  recordId: string;
  nombre: string;
  ciudad: string | null;
  visitas: number;
  ultimaVisita: string | null;
};

export type PersonaEquipo = {
  nombre: string;
  iniciales: string;
  visitas: number;
  casosAbiertos: number;
};

export type Inicio = {
  kpis: KpiInicio[];
  /** Compromisos con fecha, para el calendario. */
  pendientes: Pendiente[];
  visitasPorMes: PuntoMes[];
  resultados: ResultadoVisitas[];
  actividad: ItemActividad[];
  seguimientos: FilaSeguimiento[];
  topClientes: ClienteActivo[];
  equipo: PersonaEquipo[];
  casos: Caso[];
  casosAbiertos: number;
  casosVencidos: number;
  hoy: string;
  /** True si Airtable falló: la vista lo dice en vez de mostrar ceros. */
  error: boolean;
  /** True si la vista muestra solo los registros de la propia sesión. */
  soloPropios: boolean;
};

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** Los últimos `cantidad` meses hasta el de hoy, como claves "YYYY-MM". */
function ultimosMeses(hoy: string, cantidad: number): string[] {
  const [anio, mes] = hoy.split("-").map(Number);
  const claves: string[] = [];

  for (let atras = cantidad - 1; atras >= 0; atras -= 1) {
    // Se cuenta en meses absolutos para no depender de Date ni de zonas.
    const total = anio * 12 + (mes - 1) - atras;
    const a = Math.floor(total / 12);
    const m = (total % 12) + 1;
    claves.push(`${a}-${String(m).padStart(2, "0")}`);
  }

  return claves;
}

function etiquetaMes(clave: string): string {
  const [, mes] = clave.split("-").map(Number);
  return MESES_CORTOS[mes - 1] ?? clave;
}

/** Variación porcentual; null si no hay base con la que comparar. */
function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "--";
  const primera = partes[0][0] ?? "";
  const segunda = partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "";
  return (primera + segunda).toUpperCase();
}

function esDelCliente(
  visita: Visita,
  cliente: { id: string; nombre: string },
): boolean {
  // Las visitas guardan el serial ("CL-0007"); el nombre es el respaldo.
  return (
    (Boolean(cliente.id) && visita.idClienteCore === cliente.id) ||
    visita.cliente === cliente.nombre
  );
}

export async function cargarInicio(
  permisos: Permisos,
  sesion: { idEmpleado: string; nombre: string },
): Promise<Inicio> {
  const hoy = hoyEnBogota();

  const vacio: Inicio = {
    kpis: [],
    pendientes: [],
    visitasPorMes: [],
    resultados: [],
    actividad: [],
    seguimientos: [],
    topClientes: [],
    equipo: [],
    casos: [],
    casosAbiertos: 0,
    casosVencidos: 0,
    hoy,
    error: true,
    soloPropios: !permisos.verTodo,
  };

  let visitas: Visita[];
  let casos: Caso[];
  let clientes: Awaited<ReturnType<typeof listarClientesCompletos>>;

  try {
    [visitas, casos, clientes] = await Promise.all([
      listarVisitas(),
      listarCasos(),
      listarClientesCompletos(),
    ]);
  } catch (error) {
    console.error("cargar inicio", error);
    return vacio;
  }

  // Todo lo que sigue se calcula sobre lo que esta sesión puede ver: si no
  // tiene alcance de equipo, los KPIs y los paneles hablan solo de lo suyo.
  if (!permisos.verTodo) {
    visitas = visitas.filter((visita) => esDeLaSesion(visita, sesion));
    casos = casos.filter((caso) => esDeLaSesion(caso, sesion));
    // El maestro de clientes es dato de terceros: se recorta a la cartera que
    // esta persona efectivamente atendió, no al total de la compañía.
    clientes = clientes.filter((cliente) =>
      visitas.some((visita) => esDelCliente(visita, cliente)),
    );
  }

  /* ------------------------------ Visitas ------------------------------- */

  const dia = (fecha: string | null) => fecha?.slice(0, 10) ?? null;
  const mesDe = (fecha: string | null) => fecha?.slice(0, 7) ?? null;

  const claves12 = ultimosMeses(hoy, 12);
  const conteoPorMes = new Map<string, number>(claves12.map((c) => [c, 0]));

  for (const visita of visitas) {
    const mes = mesDe(visita.fecha);
    if (mes !== null && conteoPorMes.has(mes)) {
      conteoPorMes.set(mes, (conteoPorMes.get(mes) ?? 0) + 1);
    }
  }

  const visitasPorMes: PuntoMes[] = claves12.map((clave) => ({
    mes: clave,
    etiqueta: etiquetaMes(clave),
    visitas: conteoPorMes.get(clave) ?? 0,
  }));

  const mesActual = hoy.slice(0, 7);
  const delMes = conteoPorMes.get(mesActual) ?? 0;
  const mesAnterior = claves12[claves12.length - 2];
  const delAnterior = conteoPorMes.get(mesAnterior ?? "") ?? 0;

  /* --------------------------- Seguimientos ----------------------------- */

  const conSeguimiento = visitas.filter((visita) => visita.fechaSeguimiento);

  const seguimientos: FilaSeguimiento[] = conSeguimiento
    .map((visita) => {
      const fecha = dia(visita.fechaSeguimiento) ?? "";
      const estado: FilaSeguimiento["estado"] =
        fecha < hoy ? "Atrasado" : fecha === hoy ? "Hoy" : "Programado";

      return {
        id: visita.id,
        recordId: visita.recordId,
        cliente: visita.cliente,
        tipo: visita.tipo,
        responsable: visita.responsable,
        accion: visita.proximaAccion?.trim() || "Seguimiento pendiente",
        fecha,
        estado,
      };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const atrasados = seguimientos.filter((s) => s.estado === "Atrasado").length;

  /* ------------------------------- Casos -------------------------------- */

  const casosAbiertos = casos.filter((caso) => !estaCerrado(caso.estado));
  const casosVencidos = casosAbiertos.filter((c) => c.alerta === "vencido");

  /* ------------------------------ Clientes ------------------------------ */

  const activos = clientes.filter((cliente) => cliente.activo);

  const porCliente: ClienteActivo[] = activos.map((cliente) => {
    const suyas = visitas.filter((visita) => esDelCliente(visita, cliente));
    const fechas = suyas
      .map((visita) => dia(visita.fecha))
      .filter((fecha): fecha is string => Boolean(fecha))
      .sort();

    return {
      recordId: cliente.recordId,
      nombre: cliente.nombre,
      ciudad: cliente.ciudad,
      visitas: suyas.length,
      ultimaVisita: fechas.at(-1) ?? null,
    };
  });

  const sinVisita = porCliente.filter((c) => c.visitas === 0).length;

  const topClientes = porCliente
    .filter((cliente) => cliente.visitas > 0)
    .sort(
      (a, b) =>
        b.visitas - a.visitas || a.nombre.localeCompare(b.nombre, "es"),
    )
    .slice(0, 5);

  /* ------------------------------- Equipo ------------------------------- */

  const nombres = new Set<string>();
  for (const visita of visitas) {
    if (visita.responsable) nombres.add(visita.responsable);
  }
  for (const caso of casosAbiertos) {
    if (caso.responsable) nombres.add(caso.responsable);
  }

  const equipo: PersonaEquipo[] = [...nombres]
    .map((nombre) => ({
      nombre,
      iniciales: iniciales(nombre),
      visitas: visitas.filter((v) => v.responsable === nombre).length,
      casosAbiertos: casosAbiertos.filter((c) => c.responsable === nombre)
        .length,
    }))
    .sort(
      (a, b) => b.visitas - a.visitas || a.nombre.localeCompare(b.nombre, "es"),
    );

  /* ---------------------------- Resultados ------------------------------ */

  const conteoResultado = new Map<string, number>();
  for (const visita of visitas) {
    const resultado = visita.resultado?.trim();
    if (!resultado) continue;
    conteoResultado.set(resultado, (conteoResultado.get(resultado) ?? 0) + 1);
  }

  const resultados: ResultadoVisitas[] = [...conteoResultado.entries()]
    .map(([resultado, cantidad]) => ({ resultado, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  /* ---------------------------- Actividad ------------------------------- */

  const actividad: ItemActividad[] = [...visitas]
    .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""))
    .slice(0, 6)
    .map((visita) => ({
      id: visita.recordId,
      tipo: visita.tipo,
      titulo: visita.objetivo?.trim() || "Visita registrada",
      cliente: visita.cliente,
      responsable: visita.responsable,
      fecha: dia(visita.fecha),
    }));

  /* -------------------------------- KPIs -------------------------------- */

  const kpis: KpiInicio[] = [
    {
      id: "visitas-mes",
      titulo: "Visitas este mes",
      valor: String(delMes),
      detalle: `${visitas.length} registradas en total`,
      delta: variacion(delMes, delAnterior),
      // Solo los últimos 6 meses: 12 barras no caben en un sparkline.
      serie: visitasPorMes.slice(-6).map((punto) => punto.visitas),
    },
    {
      id: "seguimientos",
      titulo: "Seguimientos abiertos",
      valor: String(seguimientos.length),
      detalle:
        atrasados === 0
          ? "ninguno atrasado"
          : `${atrasados} ${atrasados === 1 ? "atrasado" : "atrasados"}`,
      delta: null,
      serie: [],
      bajarEsBueno: true,
    },
    {
      id: "casos",
      titulo: "Casos sin resolver",
      valor: String(casosAbiertos.length),
      detalle:
        casosVencidos.length === 0
          ? "ninguno con plazo vencido"
          : `${casosVencidos.length} con plazo vencido`,
      delta: null,
      serie: [],
      bajarEsBueno: true,
    },
    {
      id: "clientes",
      titulo: permisos.verTodo ? "Clientes activos" : "Clientes que atiendes",
      valor: String(activos.length),
      detalle:
        sinVisita === 0
          ? "todos con visita registrada"
          : `${sinVisita} sin visita registrada`,
      delta: null,
      serie: [],
    },
  ];

  return {
    kpis,
    pendientes: armarPendientes(visitas, casos, hoy),
    visitasPorMes,
    resultados,
    actividad,
    seguimientos: seguimientos.slice(0, 8),
    topClientes,
    equipo,
    casos: casosAbiertos.slice(0, 5),
    casosAbiertos: casosAbiertos.length,
    casosVencidos: casosVencidos.length,
    hoy,
    error: false,
    soloPropios: !permisos.verTodo,
  };
}
