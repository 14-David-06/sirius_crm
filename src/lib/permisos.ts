import type { SessionPayload } from "@/lib/session";

/**
 * Niveles de acceso. La fuente de verdad es la tabla `Niveles_Acceso` de la
 * base Sirius Nomina Core, que ya define el permiso de cada nivel en JSON;
 * esto solo traduce esa definición a lo que el CRM necesita decidir.
 *
 *   1 Super Admin  crear/leer/actualizar/eliminar *, configurar, gestionUsuarios
 *   2 Admin        crear/leer/actualizar *, eliminar solo propios
 *   3 Avanzado     leer propio + reportes, actualizar propio
 *   4 Usuario      leer propio, crear registros propios, actualizar propio
 *   5 Lectura      leer propio y nada más
 *
 * Un nivel ausente o desconocido cae al mínimo: es un sistema de permisos, así
 * que ante la duda se cierra, no se abre.
 */

export const NIVELES = [
  "Super Admin",
  "Admin",
  "Avanzado",
  "Usuario",
  "Lectura",
] as const;

export type Nivel = (typeof NIVELES)[number];

const ORDEN: Record<Nivel, number> = {
  "Super Admin": 1,
  Admin: 2,
  Avanzado: 3,
  Usuario: 4,
  Lectura: 5,
};

export type Permisos = {
  /** null cuando la persona no tiene nivel asignado en Airtable. */
  nivel: Nivel | null;
  /** 1 es el más alto; 99 cuando no hay nivel reconocido. */
  orden: number;
  /** Puede leer sus propios registros. Falso solo sin nivel asignado. */
  leerPropio: boolean;
  /** Puede leer registros de otras personas. */
  verTodo: boolean;
  /** Puede crear visitas y casos. */
  crear: boolean;
  /** Puede modificar registros propios. */
  actualizarPropio: boolean;
  /** Puede modificar registros de cualquiera. */
  actualizarTodo: boolean;
  /** Puede editar el maestro de clientes, contactos y productos. */
  gestionarCatalogo: boolean;
  configurar: boolean;
  gestionUsuarios: boolean;
};

const MINIMO: Permisos = {
  nivel: null,
  orden: 99,
  // Sin nivel no se lee nada, ni lo propio: la pantalla explica el motivo y a
  // quién pedirlo, que es más útil que una tabla vacía sin razón aparente.
  leerPropio: false,
  verTodo: false,
  crear: false,
  actualizarPropio: false,
  actualizarTodo: false,
  gestionarCatalogo: false,
  configurar: false,
  gestionUsuarios: false,
};

/** Normaliza el texto del lookup de Airtable ("  super admin " → "Super Admin"). */
function reconocer(valor: string | null | undefined): Nivel | null {
  const limpio = valor?.trim().toLowerCase();
  if (!limpio) return null;
  return NIVELES.find((nivel) => nivel.toLowerCase() === limpio) ?? null;
}

export function permisosDe(
  session: Pick<SessionPayload, "nivelAcceso"> | null,
): Permisos {
  const nivel = reconocer(session?.nivelAcceso);
  if (nivel === null) return MINIMO;

  const orden = ORDEN[nivel];
  const mando = orden <= 2; // Super Admin y Admin

  return {
    nivel,
    orden,
    // Todos los niveles definidos leen lo propio; "Lectura" solo eso.
    leerPropio: true,
    verTodo: mando,
    // "Avanzado" y "Lectura" no crean registros operativos; "Usuario" sí, propios.
    crear: mando || nivel === "Usuario",
    actualizarPropio: nivel !== "Lectura",
    actualizarTodo: mando,
    gestionarCatalogo: mando,
    configurar: nivel === "Super Admin",
    gestionUsuarios: nivel === "Super Admin",
  };
}

/** Compara dos nombres de persona ignorando acentos, mayúsculas y espacios. */
export function esPropio(
  responsable: string | null,
  nombre: string | null,
): boolean {
  if (!responsable || !nombre) return false;
  return normalizar(responsable) === normalizar(nombre);
}

/** Lo mínimo que identifica al dueño de un registro del CRM. */
export type Autor = {
  idPersonalCore: string | null;
  responsable: string | null;
};

/**
 * Si el registro pertenece a la sesión.
 *
 * Manda el ID de personal (`SIRIUS-PER-XXXX`): es estable y lo escribe el
 * servidor. El nombre solo se usa cuando el registro no tiene ID — los
 * anteriores a este campo — para no dejarlos huérfanos de golpe.
 */
export function esDeLaSesion(
  autor: Autor,
  sesion: { idEmpleado: string; nombre: string },
): boolean {
  if (autor.idPersonalCore && sesion.idEmpleado) {
    return autor.idPersonalCore === sesion.idEmpleado;
  }
  return esPropio(autor.responsable, sesion.nombre);
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Deja solo lo que la sesión puede leer. */
export function filtrarPorAlcance<T extends Autor>(
  registros: T[],
  permisos: Permisos,
  sesion: { idEmpleado: string; nombre: string },
): T[] {
  if (permisos.verTodo) return registros;
  if (!permisos.leerPropio) return [];
  return registros.filter((registro) => esDeLaSesion(registro, sesion));
}

/** Si puede modificar este registro concreto. */
export function puedeEditar(
  permisos: Permisos,
  autor: Autor,
  sesion: { idEmpleado: string; nombre: string },
): boolean {
  if (permisos.actualizarTodo) return true;
  return permisos.actualizarPropio && esDeLaSesion(autor, sesion);
}

/** Texto para explicar por qué una vista sale vacía o bloqueada. */
export function motivoSinAcceso(permisos: Permisos): string {
  if (permisos.nivel === null) {
    return "Tu usuario no tiene un nivel de acceso asignado en Sirius Nomina Core. Pídele a un Super Admin que te asigne uno.";
  }
  return `Tu nivel de acceso (${permisos.nivel}) solo permite ver tus propios registros, no los del resto del equipo.`;
}

/**
 * Traduce los permisos a frases legibles. La pantalla de Configuración las
 * lista para que cada persona sepa por qué ve —o no ve— cada módulo, sin
 * tener que preguntar. Sale de los mismos flags que gobiernan el sistema, así
 * que no puede desalinearse de lo que realmente ocurre.
 */
export function describirPermisos(
  permisos: Permisos,
): { etiqueta: string; permitido: boolean }[] {
  return [
    { etiqueta: "Ver los registros de todo el equipo", permitido: permisos.verTodo },
    { etiqueta: "Registrar visitas, casos y pedidos", permitido: permisos.crear },
    { etiqueta: "Editar sus propios registros", permitido: permisos.actualizarPropio },
    { etiqueta: "Editar registros de cualquier persona", permitido: permisos.actualizarTodo },
    {
      etiqueta: "Editar el maestro de clientes, contactos y productos",
      permitido: permisos.gestionarCatalogo,
    },
    { etiqueta: "Configurar el sistema", permitido: permisos.configurar },
    { etiqueta: "Gestionar usuarios y niveles de acceso", permitido: permisos.gestionUsuarios },
  ];
}
