/**
 * Datos de ejemplo para maquetar el home del CRM.
 * Nada de esto viene todavía de Airtable: cuando conectemos las tablas
 * (Clientes, Visitas, Casos, Pedidos) este archivo desaparece.
 */

export type Kpi = {
  id: string;
  titulo: string;
  valor: string;
  detalle: string;
  delta: number;
  serie: number[];
};

export const kpis: Kpi[] = [
  {
    id: "ingresos",
    titulo: "Ventas del mes",
    valor: "$284,5 M",
    detalle: "Meta $320 M",
    delta: 12.4,
    serie: [38, 42, 40, 51, 47, 58, 62, 60, 71, 68, 76, 82],
  },
  {
    id: "pipeline",
    titulo: "Pipeline abierto",
    valor: "$1.120 M",
    detalle: "38 oportunidades",
    delta: 5.8,
    serie: [60, 58, 63, 61, 67, 65, 70, 74, 72, 78, 80, 84],
  },
  {
    id: "conversion",
    titulo: "Tasa de conversión",
    valor: "31,2 %",
    detalle: "Últimos 90 días",
    delta: -2.1,
    serie: [44, 46, 43, 47, 45, 42, 44, 41, 39, 38, 36, 34],
  },
  {
    id: "casos",
    titulo: "Casos abiertos",
    valor: "17",
    detalle: "4 fuera de SLA",
    delta: -8.3,
    serie: [30, 28, 33, 31, 27, 26, 24, 25, 22, 21, 19, 17],
  },
];

export type Etapa = {
  id: string;
  nombre: string;
  monto: string;
  color: string;
  oportunidades: Oportunidad[];
};

export type Oportunidad = {
  id: string;
  cliente: string;
  producto: string;
  monto: string;
  responsable: string;
  dias: number;
  probabilidad: number;
};

export const pipeline: Etapa[] = [
  {
    id: "prospecto",
    nombre: "Prospecto",
    monto: "$310 M",
    color: "bg-slate-400",
    oportunidades: [
      {
        id: "OPP-1042",
        cliente: "Palmar del Llano",
        producto: "Biochar Blend · 40 t",
        monto: "$96 M",
        responsable: "AH",
        dias: 3,
        probabilidad: 20,
      },
      {
        id: "OPP-1039",
        cliente: "Agrícola San Martín",
        producto: "Sirius Bacter · 1.200 L",
        monto: "$74 M",
        responsable: "KA",
        dias: 6,
        probabilidad: 15,
      },
      {
        id: "OPP-1035",
        cliente: "Hacienda La Cabaña",
        producto: "Star Dust · 18 t",
        monto: "$140 M",
        responsable: "CG",
        dias: 9,
        probabilidad: 25,
      },
    ],
  },
  {
    id: "diagnostico",
    nombre: "Diagnóstico",
    monto: "$268 M",
    color: "bg-blue-400",
    oportunidades: [
      {
        id: "OPP-1028",
        cliente: "Guaicaramo S.A.S.",
        producto: "Plan nutrición 2027",
        monto: "$182 M",
        responsable: "AH",
        dias: 12,
        probabilidad: 45,
      },
      {
        id: "OPP-1026",
        cliente: "Aceites Manuelita",
        producto: "Biochar Blend · 30 t",
        monto: "$86 M",
        responsable: "LO",
        dias: 4,
        probabilidad: 40,
      },
    ],
  },
  {
    id: "propuesta",
    nombre: "Propuesta",
    monto: "$342 M",
    color: "bg-blue-600",
    oportunidades: [
      {
        id: "OPP-1017",
        cliente: "Unipalma",
        producto: "Suministro trimestral",
        monto: "$210 M",
        responsable: "CG",
        dias: 8,
        probabilidad: 60,
      },
      {
        id: "OPP-1014",
        cliente: "Palmeras del Meta",
        producto: "Sirius Bacter · 2.400 L",
        monto: "$132 M",
        responsable: "KA",
        dias: 15,
        probabilidad: 55,
      },
    ],
  },
  {
    id: "negociacion",
    nombre: "Negociación",
    monto: "$156 M",
    color: "bg-amber-500",
    oportunidades: [
      {
        id: "OPP-1008",
        cliente: "Grupo Agroindustrial DAO",
        producto: "Contrato anual biochar",
        monto: "$156 M",
        responsable: "AH",
        dias: 21,
        probabilidad: 75,
      },
    ],
  },
  {
    id: "cierre",
    nombre: "Cerrada ganada",
    monto: "$284 M",
    color: "bg-emerald-500",
    oportunidades: [
      {
        id: "OPP-0998",
        cliente: "Sapuga S.A.",
        producto: "Star Dust · 22 t",
        monto: "$168 M",
        responsable: "LO",
        dias: 2,
        probabilidad: 100,
      },
      {
        id: "OPP-0994",
        cliente: "Inversiones Tolima",
        producto: "Biochar Blend · 25 t",
        monto: "$116 M",
        responsable: "CG",
        dias: 5,
        probabilidad: 100,
      },
    ],
  },
];

export type PuntoVentas = {
  mes: string;
  ventas: number;
  meta: number;
};

export const ventasMensuales: PuntoVentas[] = [
  { mes: "Sep", ventas: 186, meta: 200 },
  { mes: "Oct", ventas: 204, meta: 210 },
  { mes: "Nov", ventas: 232, meta: 220 },
  { mes: "Dic", ventas: 198, meta: 240 },
  { mes: "Ene", ventas: 246, meta: 250 },
  { mes: "Feb", ventas: 221, meta: 260 },
  { mes: "Mar", ventas: 268, meta: 270 },
  { mes: "Abr", ventas: 254, meta: 280 },
  { mes: "May", ventas: 292, meta: 290 },
  { mes: "Jun", ventas: 276, meta: 300 },
  { mes: "Jul", ventas: 310, meta: 310 },
  { mes: "Ago", ventas: 284, meta: 320 },
];

export type EtapaEmbudo = {
  etapa: string;
  cantidad: number;
};

export const embudo: EtapaEmbudo[] = [
  { etapa: "Leads", cantidad: 420 },
  { etapa: "Contactados", cantidad: 268 },
  { etapa: "Diagnóstico", cantidad: 154 },
  { etapa: "Propuesta", cantidad: 86 },
  { etapa: "Ganadas", cantidad: 41 },
];

export type Actividad = {
  id: string;
  tipo: "llamada" | "correo" | "visita" | "nota";
  titulo: string;
  cliente: string;
  autor: string;
  cuando: string;
};

export const actividades: Actividad[] = [
  {
    id: "a1",
    tipo: "visita",
    titulo: "Visita técnica en lote 4",
    cliente: "Guaicaramo S.A.S.",
    autor: "Angélica H.",
    cuando: "hace 25 min",
  },
  {
    id: "a2",
    tipo: "correo",
    titulo: "Envío de cotización COT-0219",
    cliente: "Unipalma",
    autor: "Claudia G.",
    cuando: "hace 2 h",
  },
  {
    id: "a3",
    tipo: "llamada",
    titulo: "Seguimiento a prueba de campo",
    cliente: "Palmeras del Meta",
    autor: "Kevin A.",
    cuando: "hace 4 h",
  },
  {
    id: "a4",
    tipo: "nota",
    titulo: "Solicitan análisis de suelo antes de decidir",
    cliente: "Aceites Manuelita",
    autor: "Luis O.",
    cuando: "ayer",
  },
  {
    id: "a5",
    tipo: "visita",
    titulo: "Recorrido de finca y muestreo",
    cliente: "Hacienda La Cabaña",
    autor: "Angélica H.",
    cuando: "ayer",
  },
];

export type Tarea = {
  id: string;
  titulo: string;
  cliente: string;
  hora: string;
  prioridad: "alta" | "media" | "baja";
  hecha: boolean;
};

export const tareas: Tarea[] = [
  {
    id: "t1",
    titulo: "Llamar para confirmar despacho",
    cliente: "Sapuga S.A.",
    hora: "9:00",
    prioridad: "alta",
    hecha: true,
  },
  {
    id: "t2",
    titulo: "Enviar ficha técnica Star Dust",
    cliente: "Palmar del Llano",
    hora: "11:30",
    prioridad: "media",
    hecha: false,
  },
  {
    id: "t3",
    titulo: "Reunión de cierre contrato anual",
    cliente: "Grupo Agroindustrial DAO",
    hora: "14:00",
    prioridad: "alta",
    hecha: false,
  },
  {
    id: "t4",
    titulo: "Cargar acta de visita",
    cliente: "Agrícola San Martín",
    hora: "16:45",
    prioridad: "baja",
    hecha: false,
  },
];

export type Seguimiento = {
  id: string;
  cliente: string;
  contacto: string;
  tipo: string;
  responsable: string;
  fecha: string;
  estado: "En riesgo" | "A tiempo" | "Vencido";
};

export const seguimientos: Seguimiento[] = [
  {
    id: "VIS-0231",
    cliente: "Guaicaramo S.A.S.",
    contacto: "Mauricio Rodríguez",
    tipo: "Visita técnica",
    responsable: "Angélica H.",
    fecha: "27 ago",
    estado: "A tiempo",
  },
  {
    id: "VIS-0229",
    cliente: "Unipalma",
    contacto: "Diana Salcedo",
    tipo: "Presentación propuesta",
    responsable: "Claudia G.",
    fecha: "28 ago",
    estado: "A tiempo",
  },
  {
    id: "VIS-0224",
    cliente: "Aceites Manuelita",
    contacto: "Jorge Peña",
    tipo: "Llamada de cierre",
    responsable: "Luis O.",
    fecha: "25 ago",
    estado: "Vencido",
  },
  {
    id: "VIS-0221",
    cliente: "Palmeras del Meta",
    contacto: "Sandra Buitrago",
    tipo: "Prueba de campo",
    responsable: "Kevin A.",
    fecha: "29 ago",
    estado: "En riesgo",
  },
  {
    id: "VIS-0218",
    cliente: "Palmar del Llano",
    contacto: "Camilo Ríos",
    tipo: "Diagnóstico agronómico",
    responsable: "Angélica H.",
    fecha: "30 ago",
    estado: "A tiempo",
  },
];

export type Caso = {
  id: string;
  cliente: string;
  asunto: string;
  tipo: string;
  sla: "Dentro de SLA" | "Por vencer" | "Vencido";
  dias: number;
};

export const casos: Caso[] = [
  {
    id: "CASO-0142",
    cliente: "Sapuga S.A.",
    asunto: "Dosificación en lote joven",
    tipo: "Consulta técnica",
    sla: "Dentro de SLA",
    dias: 1,
  },
  {
    id: "CASO-0139",
    cliente: "Inversiones Tolima",
    asunto: "Faltante en remisión REM-0783",
    tipo: "Reclamo",
    sla: "Por vencer",
    dias: 3,
  },
  {
    id: "CASO-0135",
    cliente: "Agrícola San Martín",
    asunto: "Sin respuesta a análisis de suelo",
    tipo: "Seguimiento",
    sla: "Vencido",
    dias: 8,
  },
];

export type Cliente = {
  nombre: string;
  sector: string;
  monto: string;
  porcentaje: number;
};

export const topClientes: Cliente[] = [
  {
    nombre: "Guaicaramo S.A.S.",
    sector: "Palma",
    monto: "$412 M",
    porcentaje: 100,
  },
  { nombre: "Unipalma", sector: "Palma", monto: "$318 M", porcentaje: 77 },
  { nombre: "Sapuga S.A.", sector: "Palma", monto: "$264 M", porcentaje: 64 },
  {
    nombre: "Aceites Manuelita",
    sector: "Palma",
    monto: "$196 M",
    porcentaje: 48,
  },
  {
    nombre: "Hacienda La Cabaña",
    sector: "Ganadería",
    monto: "$154 M",
    porcentaje: 37,
  },
];

export const equipo = [
  { iniciales: "AH", nombre: "Angélica H.", cerradas: 9, cuota: 86 },
  { iniciales: "CG", nombre: "Claudia G.", cerradas: 7, cuota: 72 },
  { iniciales: "KA", nombre: "Kevin A.", cerradas: 5, cuota: 58 },
  { iniciales: "LO", nombre: "Luis O.", cerradas: 4, cuota: 44 },
];
