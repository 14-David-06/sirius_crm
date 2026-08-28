import { cachearLectura, ETIQUETAS } from "@/lib/cache";
import { env } from "@/lib/env";

const AIRTABLE_API = "https://api.airtable.com/v0";

export type AirtableRecord = {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
};

/**
 * Airtable corta en 5 peticiones por segundo y por base, y responde 429. Sin
 * reintento eso se convierte en una excepción y la página entera se cae, así
 * que se reintenta con espera creciente. También se reintentan los 5xx, que
 * son fallos transitorios del lado de Airtable.
 */
const REINTENTOS = 3;
const ESPERA_BASE_MS = 500;

function esReintentable(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Espera del `Retry-After` si viene, o exponencial con algo de dispersión. */
function esperaMs(respuesta: Response, intento: number): number {
  const cabecera = Number(respuesta.headers.get("retry-after"));
  if (Number.isFinite(cabecera) && cabecera > 0) {
    return Math.min(cabecera * 1000, 30_000);
  }
  // La dispersión evita que varias peticiones en paralelo reintenten al unísono.
  const exponencial = ESPERA_BASE_MS * 2 ** intento;
  return Math.min(exponencial + Math.random() * 250, 8_000);
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

/** Cliente HTTP mínimo sobre la REST API de Airtable, con reintentos. */
export async function airtableRequest<T>(
  baseId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  let ultimoDetalle = "";
  let ultimoStatus = 0;

  for (let intento = 0; intento <= REINTENTOS; intento += 1) {
    const response = await fetch(`${AIRTABLE_API}/${baseId}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.airtableApiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    ultimoStatus = response.status;
    ultimoDetalle = await response.text();

    if (!esReintentable(response.status) || intento === REINTENTOS) {
      break;
    }

    const espera = esperaMs(response, intento);
    console.warn(
      `Airtable ${response.status} en ${path.slice(0, 60)} · reintento ${intento + 1}/${REINTENTOS} en ${Math.round(espera)}ms`,
    );
    await dormir(espera);
  }

  throw new Error(`Airtable ${ultimoStatus}: ${ultimoDetalle.slice(0, 300)}`);
}

/** Trae todos los registros de una tabla paginando hasta agotar el offset. */
export async function listarRegistros(
  baseId: string,
  tableId: string,
  opciones: {
    fields?: string[];
    filterByFormula?: string;
    sort?: { field: string; direction?: "asc" | "desc" }[];
    maxRecords?: number;
  } = {},
): Promise<AirtableRecord[]> {
  const registros: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (opciones.filterByFormula) {
      params.set("filterByFormula", opciones.filterByFormula);
    }
    if (opciones.maxRecords) {
      params.set("maxRecords", String(opciones.maxRecords));
    }
    if (offset) params.set("offset", offset);
    for (const campo of opciones.fields ?? []) {
      params.append("fields[]", campo);
    }
    opciones.sort?.forEach((orden, indice) => {
      params.set(`sort[${indice}][field]`, orden.field);
      params.set(`sort[${indice}][direction]`, orden.direction ?? "asc");
    });

    const data = await airtableRequest<{
      records: AirtableRecord[];
      offset?: string;
    }>(baseId, `/${encodeURIComponent(tableId)}?${params}`);

    registros.push(...data.records);
    offset = data.offset;
  } while (offset && (!opciones.maxRecords || registros.length < opciones.maxRecords));

  return registros;
}

export async function crearRegistro(
  baseId: string,
  tableId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const data = await airtableRequest<{ records: AirtableRecord[] }>(
    baseId,
    `/${encodeURIComponent(tableId)}`,
    {
      method: "POST",
      body: JSON.stringify({ records: [{ fields }], typecast: true }),
    },
  );
  return data.records[0];
}

export async function actualizarRegistro(
  baseId: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const data = await airtableRequest<{ records: AirtableRecord[] }>(
    baseId,
    `/${encodeURIComponent(tableId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        records: [{ id: recordId, fields }],
        typecast: true,
      }),
    },
  );
  return data.records[0];
}

/* --------------------------- Lectura de celdas --------------------------- */

/** Normaliza el valor de una celda a texto (maneja selects, lookups y links). */
export function texto(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return texto(value[0]);
  if (value && typeof value === "object" && "name" in value) {
    return texto((value as { name: unknown }).name);
  }
  return null;
}

/* ------------------------- Usuarios (autenticación) ---------------------- */

const CAMPOS_PERSONAL = {
  idEmpleado: "ID Empleado",
  nombre: "Nombre completo",
  documento: "Numero Documento",
  password: "Password",
  estado: "Estado de actividad",
  rol: "Rol (from Rol)",
  nivelAcceso: "Nivel Acceso (from Nivel_Sistema_Nuevo)",
} as const;

export type Persona = {
  recordId: string;
  idEmpleado: string;
  nombre: string;
  cedula: string;
  passwordHash: string | null;
  activo: boolean;
  rol: string | null;
  nivelAcceso: string | null;
};

function aPersona(record: AirtableRecord): Persona {
  const f = record.fields;
  return {
    recordId: record.id,
    idEmpleado: texto(f[CAMPOS_PERSONAL.idEmpleado]) ?? "",
    nombre: texto(f[CAMPOS_PERSONAL.nombre]) ?? "",
    cedula: texto(f[CAMPOS_PERSONAL.documento]) ?? "",
    passwordHash: texto(f[CAMPOS_PERSONAL.password]),
    activo: texto(f[CAMPOS_PERSONAL.estado]) === "Activo",
    rol: texto(f[CAMPOS_PERSONAL.rol]),
    nivelAcceso: texto(f[CAMPOS_PERSONAL.nivelAcceso]),
  };
}

/** Busca una persona por su número de documento. Devuelve null si no existe. */
export async function findPersonaByCedula(
  cedula: string,
): Promise<Persona | null> {
  const registros = await listarRegistros(env.baseNomina, env.tablaPersonal, {
    filterByFormula: `TRIM({${CAMPOS_PERSONAL.documento}}) = '${cedula}'`,
    fields: Object.values(CAMPOS_PERSONAL),
    maxRecords: 1,
  });

  return registros[0] ? aPersona(registros[0]) : null;
}

/** Guarda el hash bcrypt de la contraseña en el registro de la persona. */
export async function savePasswordHash(
  recordId: string,
  passwordHash: string,
): Promise<void> {
  await actualizarRegistro(env.baseNomina, env.tablaPersonal, recordId, {
    [CAMPOS_PERSONAL.password]: passwordHash,
  });
}

export type PersonaActiva = {
  nombre: string;
  rol: string | null;
  /** ID Empleado ("SIRIUS-PER-XXXX"): la clave con la que el CRM marca autoría. */
  idEmpleado: string;
};

const leerPersonal = cachearLectura(
  "personal-activo",
  ETIQUETAS.personal,
  async (): Promise<PersonaActiva[]> => {
    const registros = await listarRegistros(env.baseNomina, env.tablaPersonal, {
      fields: [
        CAMPOS_PERSONAL.nombre,
        CAMPOS_PERSONAL.estado,
        CAMPOS_PERSONAL.rol,
        CAMPOS_PERSONAL.idEmpleado,
      ],
      filterByFormula: `{${CAMPOS_PERSONAL.estado}} = 'Activo'`,
    });

    return registros
      .map((registro) => ({
        nombre: texto(registro.fields[CAMPOS_PERSONAL.nombre]) ?? "",
        rol: texto(registro.fields[CAMPOS_PERSONAL.rol]),
        idEmpleado: texto(registro.fields[CAMPOS_PERSONAL.idEmpleado]) ?? "",
      }))
      .filter((persona) => persona.nombre && persona.idEmpleado)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },
);

/** Personal activo, para el selector de responsable comercial. */
export async function listarPersonalActivo(): Promise<PersonaActiva[]> {
  return leerPersonal();
}

export type AccesoEquipo = {
  idEmpleado: string;
  nombre: string;
  rol: string | null;
  nivelAcceso: string | null;
  /**
   * Si ya definió contraseña. Se expone como booleano y nunca el hash: quien
   * mira esta pantalla necesita saber a quién falta activar, no la credencial.
   */
  tieneClave: boolean;
};

const leerAccesos = cachearLectura(
  "accesos-equipo",
  ETIQUETAS.personal,
  async (): Promise<AccesoEquipo[]> => {
    const registros = await listarRegistros(env.baseNomina, env.tablaPersonal, {
      fields: [
        CAMPOS_PERSONAL.idEmpleado,
        CAMPOS_PERSONAL.nombre,
        CAMPOS_PERSONAL.rol,
        CAMPOS_PERSONAL.nivelAcceso,
        CAMPOS_PERSONAL.estado,
        CAMPOS_PERSONAL.password,
      ],
      filterByFormula: `{${CAMPOS_PERSONAL.estado}} = 'Activo'`,
    });

    return registros
      .map((registro) => ({
        idEmpleado: texto(registro.fields[CAMPOS_PERSONAL.idEmpleado]) ?? "",
        nombre: texto(registro.fields[CAMPOS_PERSONAL.nombre]) ?? "",
        rol: texto(registro.fields[CAMPOS_PERSONAL.rol]),
        nivelAcceso: texto(registro.fields[CAMPOS_PERSONAL.nivelAcceso]),
        tieneClave: Boolean(texto(registro.fields[CAMPOS_PERSONAL.password])),
      }))
      .filter((persona) => persona.nombre)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },
);

/** Quién tiene qué nivel de acceso al CRM. Solo para Super Admin. */
export async function listarAccesosEquipo(): Promise<AccesoEquipo[]> {
  return leerAccesos();
}
