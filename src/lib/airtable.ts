import { env } from "@/lib/env";

const AIRTABLE_API = "https://api.airtable.com/v0";

export type AirtableRecord = {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
};

/** Cliente HTTP mínimo sobre la REST API de Airtable. */
export async function airtableRequest<T>(
  baseId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${AIRTABLE_API}/${baseId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.airtableApiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detalle = await response.text();
    throw new Error(`Airtable ${response.status}: ${detalle.slice(0, 300)}`);
  }

  return response.json() as Promise<T>;
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

/** Personal activo, para el selector de responsable comercial. */
export async function listarPersonalActivo(): Promise<
  { nombre: string; rol: string | null }[]
> {
  const registros = await listarRegistros(env.baseNomina, env.tablaPersonal, {
    fields: [
      CAMPOS_PERSONAL.nombre,
      CAMPOS_PERSONAL.estado,
      CAMPOS_PERSONAL.rol,
    ],
    filterByFormula: `{${CAMPOS_PERSONAL.estado}} = 'Activo'`,
  });

  return registros
    .map((registro) => ({
      nombre: texto(registro.fields[CAMPOS_PERSONAL.nombre]) ?? "",
      rol: texto(registro.fields[CAMPOS_PERSONAL.rol]),
    }))
    .filter((persona) => persona.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
