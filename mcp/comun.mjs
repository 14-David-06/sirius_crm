/**
 * Utilidades que comparten las herramientas: resolver referencias y recortar.
 *
 * Los resolvedores reciben el cliente del CRM como primer argumento en vez de
 * importarlo: es lo que permite que las mismas herramientas sirvan al servidor
 * stdio (que entra con cédula y contraseña) y al endpoint remoto (que ya tiene
 * la sesión de quien llama por OAuth).
 */

/** Sin acentos, sin mayúsculas, sin espacios de más. Igual que el CRM. */
export function normalizar(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function contiene(texto, buscado) {
  return normalizar(texto).includes(normalizar(buscado));
}

/**
 * Traduce lo que sea que dijo el usuario a un cliente del maestro.
 *
 * Acepta el serial (`CL-0007`), el record id de Airtable o el nombre, entero o
 * en pedazos. Cuando hay varios candidatos no elige: los devuelve en el error
 * para que la conversación lo aclare. Adivinar en un CRM significa registrar
 * una visita a la empresa equivocada.
 */
export async function resolverCliente(api, referencia) {
  const { clientes } = await api.obtener("/api/clientes");
  const buscado = normalizar(referencia);

  const exacto = clientes.find(
    (cliente) =>
      normalizar(cliente.id) === buscado ||
      cliente.recordId === referencia ||
      normalizar(cliente.nombre) === buscado,
  );
  if (exacto) return exacto;

  const parciales = clientes.filter((cliente) =>
    contiene(cliente.nombre, referencia),
  );

  if (parciales.length === 1) return parciales[0];

  if (parciales.length === 0) {
    throw new Error(
      `No hay ningún cliente que coincida con «${referencia}». Usa crm_buscar_clientes para ver el maestro.`,
    );
  }

  const lista = parciales
    .slice(0, 10)
    .map((cliente) => `${cliente.id || cliente.recordId} — ${cliente.nombre}`)
    .join("; ");
  throw new Error(
    `«${referencia}» coincide con ${parciales.length} clientes: ${lista}. Precisa cuál.`,
  );
}

/** Igual que el anterior, pero para el catálogo de productos. */
export async function resolverProducto(api, referencia) {
  const { productos } = await api.obtener("/api/productos");
  const buscado = normalizar(referencia);

  const exacto = productos.find(
    (producto) =>
      normalizar(producto.codigo) === buscado ||
      producto.recordId === referencia ||
      normalizar(producto.nombre) === buscado ||
      normalizar(producto.abreviatura) === buscado,
  );
  if (exacto) return exacto;

  const parciales = productos.filter(
    (producto) =>
      contiene(producto.nombre, referencia) ||
      contiene(producto.abreviatura, referencia),
  );
  if (parciales.length === 1) return parciales[0];

  if (parciales.length === 0) {
    throw new Error(
      `No hay ningún producto que coincida con «${referencia}». Usa crm_listar_productos para ver el catálogo.`,
    );
  }

  const lista = parciales
    .slice(0, 10)
    .map((producto) => `${producto.codigo} — ${producto.nombre}`)
    .join("; ");
  throw new Error(
    `«${referencia}» coincide con ${parciales.length} productos: ${lista}. Precisa cuál.`,
  );
}

/** Busca un registro ya listado por record id o por serial legible. */
export function porId(registros, referencia) {
  const buscado = normalizar(referencia);
  return (
    registros.find(
      (registro) =>
        registro.recordId === referencia || normalizar(registro.id) === buscado,
    ) ?? null
  );
}

/** Quita las claves nulas o vacías: la respuesta se lee sin ruido. */
export function limpiar(objeto) {
  const salida = {};
  for (const [clave, valor] of Object.entries(objeto)) {
    if (valor === null || valor === undefined || valor === "") continue;
    if (Array.isArray(valor) && valor.length === 0) continue;
    salida[clave] = valor;
  }
  return salida;
}

/** Filtra por rango de fechas `YYYY-MM-DD`; los sin fecha no pasan el filtro. */
export function enRango(fecha, desde, hasta) {
  if (desde && (!fecha || fecha < desde)) return false;
  if (hasta && (!fecha || fecha > hasta)) return false;
  return true;
}

/** El día de hoy en Bogotá, la zona en la que opera el CRM. */
export function hoy() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Toda respuesta sale como JSON en un bloque de texto: es lo que el protocolo
 * garantiza que cualquier cliente MCP puede mostrar, y a diferencia de una
 * tabla en prosa no pierde los identificadores que hacen falta para la
 * llamada siguiente.
 */
export function respuesta(datos) {
  return {
    content: [{ type: "text", text: JSON.stringify(datos, null, 1) }],
  };
}
