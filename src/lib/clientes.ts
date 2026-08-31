import {
  actualizarRegistro,
  crearRegistro,
  listarRegistros,
  texto,
  type AirtableRecord,
} from "@/lib/airtable";
import { cachearLectura, ETIQUETAS } from "@/lib/cache";
import {
  reconocerFunciones,
  type CanalConocimiento,
  type TipoContacto,
} from "@/lib/clientes-comun";
import { env } from "@/lib/env";

/**
 * Base "Sirius Clients Core": el maestro de clientes, su personal de contacto
 * y los cultivos que tienen sembrados. Las visitas y los casos viven en la
 * base del CRM y se cruzan desde `@/lib/crm`.
 */

const CAMPOS_CLIENTE = {
  id: "ID",
  nombre: "Cliente",
  nit: "Nit",
  direccion: "Direccion",
  ciudad: "Ciudad",
  departamento: "Departamento",
  estado: "Estado Cliente",
  coordenadas: "coordenadas_gps",
  distancia: "distancia_bodega_km",
  creado: "Fecha de creacion",
  sector: "Sector o cultivo",
  segmento: "Segmento (potencial)",
  etapa: "Etapa comercial",
  responsableComercial: "Responsable comercial",
  vinculacion: "Fecha de vinculación",
  observaciones: "Observaciones",
  comoConocio: "Como Conocio Sirius",
  comoConocioDetalle: "Como Conocio Detalle",
  creadoPor: "Creado Por ID",
  modificadoPor: "Modificado Por ID",
} as const;

const CAMPOS_CONTACTO = {
  codigo: "Codigo Persona Cliente",
  nombre: "Nombre Completo",
  cargo: "Cargo",
  /** Las áreas que cubre el contacto: una o varias. */
  funciones: "Funciones",
  cedula: "Cedula",
  email: "Email",
  emailNotificacion: "Email Notificacion",
  telefono: "Teléfono",
  cliente: "Cliente",
  estado: "Estado Personal",
  creadoPor: "Creado Por ID",
  modificadoPor: "Modificado Por ID",
} as const;

const CAMPOS_CULTIVO = {
  id: "ID",
  nombre: "nombre_cultivo",
  cliente: "cliente_id",
  tipo: "tipo_cultivo",
  estado: "estado",
  tecnico: "tecnico_responsable",
  lotes: "Recuento (lotes_asociados)",
} as const;

export type Cliente = {
  recordId: string;
  /** Serial legible, formato CL-000X. Es el que guardan las visitas. */
  id: string;
  nombre: string;
  nit: string | null;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  estado: string | null;
  activo: boolean;
  coordenadas: string | null;
  distanciaBodegaKm: number | null;
  creado: string | null;
  sector: string | null;
  segmento: string | null;
  etapa: string | null;
  responsableComercial: string | null;
  vinculacion: string | null;
  observaciones: string | null;
  /** Por dónde llegó el cliente; null si nadie lo registró. */
  comoConocio: string | null;
  /** Solo tiene contenido cuando el canal es "Otro". */
  comoConocioDetalle: string | null;
  /** Auditoría: ID Empleado de quien lo creó y de quien lo tocó por última vez. */
  creadoPor: string | null;
  modificadoPor: string | null;
};

export type ContactoCliente = {
  recordId: string;
  codigo: string | null;
  nombre: string;
  cargo: string | null;
  /** Áreas que cubre dentro del cliente; vacío si nadie lo clasificó. */
  funciones: TipoContacto[];
  cedula: string | null;
  email: string | null;
  emailNotificacion: string | null;
  telefono: string | null;
  activo: boolean;
  clientes: string[];
  /** Auditoría: ID Empleado de quien lo creó y de quien lo tocó por última vez. */
  creadoPor: string | null;
  modificadoPor: string | null;
};

export type CultivoCliente = {
  recordId: string;
  id: string | null;
  nombre: string;
  tipo: string | null;
  estado: string | null;
  tecnico: string | null;
  lotes: number;
  clientes: string[];
};

/**
 * En Airtable varias celdas traen "N/A" escrito a mano en lugar de quedar
 * vacías; para la interfaz es lo mismo que no tener dato.
 */
function textoLimpio(value: unknown): string | null {
  const valor = texto(value);
  if (!valor) return null;
  const normalizado = valor.toUpperCase().replace(/[.\s]/g, "");
  return normalizado === "NA" || normalizado === "NINGUNO" ? null : valor;
}

/** Igual que `texto`, pero para celdas numéricas (una cadena vacía no es 0). */
function numero(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Los campos de vínculo devuelven un arreglo de record ids. */
function vinculos(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function aCliente(record: AirtableRecord): Cliente {
  const f = record.fields;
  const estado = texto(f[CAMPOS_CLIENTE.estado]);

  return {
    recordId: record.id,
    id: texto(f[CAMPOS_CLIENTE.id]) ?? "",
    nombre: texto(f[CAMPOS_CLIENTE.nombre]) ?? "",
    nit: textoLimpio(f[CAMPOS_CLIENTE.nit]),
    direccion: textoLimpio(f[CAMPOS_CLIENTE.direccion]),
    ciudad: textoLimpio(f[CAMPOS_CLIENTE.ciudad]),
    departamento: textoLimpio(f[CAMPOS_CLIENTE.departamento]),
    estado,
    activo: estado !== "Inactivo",
    coordenadas: textoLimpio(f[CAMPOS_CLIENTE.coordenadas]),
    distanciaBodegaKm: numero(f[CAMPOS_CLIENTE.distancia]),
    creado: texto(f[CAMPOS_CLIENTE.creado]),
    sector: textoLimpio(f[CAMPOS_CLIENTE.sector]),
    segmento: textoLimpio(f[CAMPOS_CLIENTE.segmento]),
    etapa: textoLimpio(f[CAMPOS_CLIENTE.etapa]),
    responsableComercial: textoLimpio(f[CAMPOS_CLIENTE.responsableComercial]),
    vinculacion: texto(f[CAMPOS_CLIENTE.vinculacion]),
    observaciones: texto(f[CAMPOS_CLIENTE.observaciones]),
    comoConocio: texto(f[CAMPOS_CLIENTE.comoConocio]),
    comoConocioDetalle: textoLimpio(f[CAMPOS_CLIENTE.comoConocioDetalle]),
    creadoPor: texto(f[CAMPOS_CLIENTE.creadoPor]),
    modificadoPor: texto(f[CAMPOS_CLIENTE.modificadoPor]),
  };
}

const leerClientes = cachearLectura(
  // v2: `Cliente` sumó canal, datos comerciales y auditoría.
  "clientes-v2",
  ETIQUETAS.clientes,
  async (): Promise<Cliente[]> => {
    const registros = await listarRegistros(
      env.baseClientes,
      env.tablaClientes,
      { fields: Object.values(CAMPOS_CLIENTE) },
    );

    return registros
      .map(aCliente)
      .filter((cliente) => cliente.nombre)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },
);

/** Todos los clientes, activos e inactivos, para el listado del módulo. */
export async function listarClientesCompletos(): Promise<Cliente[]> {
  return leerClientes();
}

const leerCliente = cachearLectura(
  "cliente-v2",
  ETIQUETAS.clientes,
  async (recordId: string): Promise<Cliente | null> => {
    const registros = await listarRegistros(
      env.baseClientes,
      env.tablaClientes,
      {
        fields: Object.values(CAMPOS_CLIENTE),
        filterByFormula: `RECORD_ID() = '${recordId}'`,
        maxRecords: 1,
      },
    );

    return registros[0] ? aCliente(registros[0]) : null;
  },
);

export async function obtenerCliente(recordId: string): Promise<Cliente | null> {
  return leerCliente(recordId);
}

/* --------------------------- Escritura de cliente ------------------------ */

/**
 * Lo que la ficha deja corregir. El serial (`ID`), la fecha de creación y las
 * relaciones —contactos, cultivos— no están aquí: no son datos que se
 * corrijan escribiendo, se administran desde su propio módulo.
 */
export type CambiosCliente = {
  nombre: string;
  nit: string | null;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  coordenadas: string | null;
  distanciaBodegaKm: number | null;
  sector: string | null;
  segmento: string | null;
  etapa: string | null;
  responsableComercial: string | null;
  vinculacion: string | null;
  observaciones: string | null;
  comoConocio: CanalConocimiento | null;
  /** Solo se guarda cuando el canal es "Otro"; en los demás se limpia. */
  comoConocioDetalle: string | null;
};

export async function actualizarCliente(
  recordId: string,
  datos: CambiosCliente,
  autorId: string,
): Promise<Cliente> {
  const registro = await actualizarRegistro(
    env.baseClientes,
    env.tablaClientes,
    recordId,
    {
      [CAMPOS_CLIENTE.nombre]: datos.nombre,
      [CAMPOS_CLIENTE.nit]: datos.nit ?? "",
      [CAMPOS_CLIENTE.direccion]: datos.direccion ?? "",
      [CAMPOS_CLIENTE.ciudad]: datos.ciudad ?? "",
      [CAMPOS_CLIENTE.departamento]: datos.departamento ?? "",
      [CAMPOS_CLIENTE.coordenadas]: datos.coordenadas ?? "",
      // El número sí va como null: "" no es un número y Airtable lo rechaza.
      [CAMPOS_CLIENTE.distancia]: datos.distanciaBodegaKm,
      [CAMPOS_CLIENTE.sector]: datos.sector ?? "",
      [CAMPOS_CLIENTE.segmento]: datos.segmento ?? "",
      [CAMPOS_CLIENTE.etapa]: datos.etapa ?? "",
      [CAMPOS_CLIENTE.responsableComercial]: datos.responsableComercial ?? "",
      [CAMPOS_CLIENTE.vinculacion]: datos.vinculacion,
      [CAMPOS_CLIENTE.observaciones]: datos.observaciones ?? "",
      // Un singleSelect se vacía con null; "" no es una de sus opciones.
      [CAMPOS_CLIENTE.comoConocio]: datos.comoConocio,
      [CAMPOS_CLIENTE.comoConocioDetalle]: datos.comoConocioDetalle ?? "",
      [CAMPOS_CLIENTE.modificadoPor]: autorId,
    },
  );
  return aCliente(registro);
}

/**
 * Activa o inactiva el cliente. Nunca se borra: sus visitas, casos y pedidos
 * lo referencian por serial y quedarían huérfanos.
 */
export async function cambiarEstadoCliente(
  recordId: string,
  activo: boolean,
  autorId: string,
): Promise<Cliente> {
  const registro = await actualizarRegistro(
    env.baseClientes,
    env.tablaClientes,
    recordId,
    {
      [CAMPOS_CLIENTE.estado]: activo ? "Activo" : "Inactivo",
      [CAMPOS_CLIENTE.modificadoPor]: autorId,
    },
  );
  return aCliente(registro);
}

const leerContactos = cachearLectura(
  // v2: `tipo` (uno) pasó a `funciones` (varias).
  "contactos-v2",
  ETIQUETAS.contactos,
  async (): Promise<ContactoCliente[]> => {
    const registros = await listarRegistros(
      env.baseClientes,
      env.tablaPersonalCliente,
      { fields: Object.values(CAMPOS_CONTACTO) },
    );

    return registros
      .map(aContacto)
      .filter((contacto) => contacto.nombre)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },
);

export async function listarContactos(): Promise<ContactoCliente[]> {
  return leerContactos();
}

export type EntradaContacto = {
  nombre: string;
  cliente: string;
  /** ID Empleado de quien lo está creando. */
  autorId: string;
  cargo?: string;
  funciones?: TipoContacto[];
  cedula?: string;
  email?: string;
  emailNotificacion?: string;
  telefono?: string;
};

function aContacto(registro: AirtableRecord): ContactoCliente {
  const f = registro.fields;
  return {
    recordId: registro.id,
    codigo: texto(f[CAMPOS_CONTACTO.codigo]),
    nombre: texto(f[CAMPOS_CONTACTO.nombre]) ?? "",
    cargo: texto(f[CAMPOS_CONTACTO.cargo]),
    funciones: reconocerFunciones(f[CAMPOS_CONTACTO.funciones]),
    cedula: texto(f[CAMPOS_CONTACTO.cedula]),
    email: texto(f[CAMPOS_CONTACTO.email]),
    emailNotificacion: texto(f[CAMPOS_CONTACTO.emailNotificacion]),
    telefono: texto(f[CAMPOS_CONTACTO.telefono]),
    activo: texto(f[CAMPOS_CONTACTO.estado]) !== "Inactivo",
    clientes: vinculos(f[CAMPOS_CONTACTO.cliente]),
    creadoPor: texto(f[CAMPOS_CONTACTO.creadoPor]),
    modificadoPor: texto(f[CAMPOS_CONTACTO.modificadoPor]),
  };
}

export async function crearContacto(
  entrada: EntradaContacto,
): Promise<ContactoCliente> {
  const registro = await crearRegistro(
    env.baseClientes,
    env.tablaPersonalCliente,
    {
      [CAMPOS_CONTACTO.nombre]: entrada.nombre,
      [CAMPOS_CONTACTO.cliente]: [entrada.cliente],
      [CAMPOS_CONTACTO.cargo]: entrada.cargo ?? "",
      [CAMPOS_CONTACTO.funciones]: entrada.funciones ?? [],
      [CAMPOS_CONTACTO.cedula]: entrada.cedula ?? "",
      [CAMPOS_CONTACTO.email]: entrada.email ?? "",
      [CAMPOS_CONTACTO.emailNotificacion]: entrada.emailNotificacion ?? "",
      [CAMPOS_CONTACTO.telefono]: entrada.telefono ?? "",
      [CAMPOS_CONTACTO.estado]: "Activo",
      [CAMPOS_CONTACTO.creadoPor]: entrada.autorId,
      [CAMPOS_CONTACTO.modificadoPor]: entrada.autorId,
    },
  );
  return aContacto(registro);
}

/** Lo que se puede corregir de un contacto ya creado. */
export type CambiosContacto = {
  nombre: string;
  cargo: string | null;
  funciones: TipoContacto[];
  cedula: string | null;
  email: string | null;
  emailNotificacion: string | null;
  telefono: string | null;
};

/**
 * Reescribe la ficha del contacto. El cliente al que pertenece no se toca
 * aquí: mover a alguien de empresa no es una corrección de datos, es otro
 * contacto.
 */
export async function actualizarContacto(
  recordId: string,
  datos: CambiosContacto,
  autorId: string,
): Promise<ContactoCliente> {
  const registro = await actualizarRegistro(
    env.baseClientes,
    env.tablaPersonalCliente,
    recordId,
    {
      [CAMPOS_CONTACTO.nombre]: datos.nombre,
      [CAMPOS_CONTACTO.cargo]: datos.cargo ?? "",
      [CAMPOS_CONTACTO.funciones]: datos.funciones,
      [CAMPOS_CONTACTO.cedula]: datos.cedula ?? "",
      [CAMPOS_CONTACTO.email]: datos.email ?? "",
      [CAMPOS_CONTACTO.emailNotificacion]: datos.emailNotificacion ?? "",
      [CAMPOS_CONTACTO.telefono]: datos.telefono ?? "",
      [CAMPOS_CONTACTO.modificadoPor]: autorId,
    },
  );
  return aContacto(registro);
}

export async function cambiarEstadoContacto(
  recordId: string,
  activo: boolean,
  autorId: string,
): Promise<ContactoCliente> {
  const registro = await actualizarRegistro(
    env.baseClientes,
    env.tablaPersonalCliente,
    recordId,
    {
      [CAMPOS_CONTACTO.estado]: activo ? "Activo" : "Inactivo",
      [CAMPOS_CONTACTO.modificadoPor]: autorId,
    },
  );
  return aContacto(registro);
}

const leerCultivos = cachearLectura(
  "cultivos",
  ETIQUETAS.cultivos,
  async (): Promise<CultivoCliente[]> => {
  const registros = await listarRegistros(env.baseClientes, env.tablaCultivos, {
    fields: Object.values(CAMPOS_CULTIVO),
  });

  return registros
    .map((registro) => {
      const f = registro.fields;
      return {
        recordId: registro.id,
        id: texto(f[CAMPOS_CULTIVO.id]),
        nombre: texto(f[CAMPOS_CULTIVO.nombre]) ?? "Sin nombre",
        tipo: texto(f[CAMPOS_CULTIVO.tipo]),
        estado: texto(f[CAMPOS_CULTIVO.estado]),
        tecnico: texto(f[CAMPOS_CULTIVO.tecnico]),
        lotes: numero(f[CAMPOS_CULTIVO.lotes]) ?? 0,
        clientes: vinculos(f[CAMPOS_CULTIVO.cliente]),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },
);

export async function listarCultivos(): Promise<CultivoCliente[]> {
  return leerCultivos();
}

/* ------------------------- Selector del formulario ----------------------- */

export type ClienteCore = {
  recordId: string;
  id: string;
  nombre: string;
  ciudad: string | null;
  departamento: string | null;
};

/** Solo los activos: es la lista que alimenta el autocompletar de Visitas. */
export async function listarClientes(): Promise<ClienteCore[]> {
  const clientes = await listarClientesCompletos();

  return clientes
    .filter((cliente) => cliente.activo)
    .map((cliente) => ({
      recordId: cliente.recordId,
      id: cliente.id,
      nombre: cliente.nombre,
      ciudad: cliente.ciudad,
      departamento: cliente.departamento,
    }));
}
