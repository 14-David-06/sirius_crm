/**
 * Interpreta un dictado libre de una visita y reparte el texto en los campos
 * del formulario. Es heurístico a propósito: no llama a ningún modelo, solo
 * busca las señales que el equipo comercial usa al hablar. Todo lo que
 * proponga queda visible y editable antes de guardar.
 *
 * Hay dos formas de dictar y las dos funcionan:
 *  - Nombrando el campo ("la próxima acción es…", "las observaciones son…"),
 *    que es lo más fiable porque el texto se corta exactamente ahí.
 *  - Hablando corrido, donde se reparte por frases según el verbo que usan.
 */

export type ProductoDictado = { codigo: string; nombre: string };

export type ResultadoDictado = {
  objetivo: string;
  necesidad: string;
  proximaAccion: string;
  observaciones: string;
  tipo: string | null;
  resultado: string | null;
  productos: string[];
  fechaSeguimiento: string | null;
  cliente: string | null;
};

const DIAS_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const NUMEROS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  quince: 15,
  veinte: 20,
  treinta: 30,
};

/** Tildes y diéresis, una a una: mantener la longitud del texto es lo que
 *  permite cortar el original usando índices calculados sobre el aplanado. */
const SIN_TILDE: Record<string, string> = {
  á: "a",
  à: "a",
  ä: "a",
  â: "a",
  é: "e",
  è: "e",
  ë: "e",
  ê: "e",
  í: "i",
  ì: "i",
  ï: "i",
  î: "i",
  ó: "o",
  ò: "o",
  ö: "o",
  ô: "o",
  ú: "u",
  ù: "u",
  ü: "u",
  û: "u",
  ñ: "n",
};

/**
 * Minúsculas sin tildes, carácter por carácter. A diferencia de un
 * `normalize("NFD")`, no cambia la longitud: `plano[i]` corresponde
 * siempre a `texto[i]`.
 */
export function normalizar(texto: string): string {
  let plano = "";
  for (const caracter of texto.toLowerCase()) {
    plano += SIN_TILDE[caracter] ?? caracter;
  }
  return plano;
}

type CampoDictado =
  | "objetivo"
  | "necesidad"
  | "proximaAccion"
  | "observaciones"
  | "fechaSeguimiento";

/** Frases con las que el equipo nombra un campo en voz alta. */
const MARCADORES: { campo: CampoDictado; patron: RegExp }[] = [
  {
    campo: "objetivo",
    patron:
      /\b(?:el\s+)?objetivo(?:\s+de\s+la\s+visita)?\s*(?:es|fue|era|fueron)?\b/g,
  },
  {
    campo: "necesidad",
    patron:
      /\b(?:la\s+)?necesidad(?:es)?\s*(?:identificada|es|era|fue)?\b|\b(?:el\s+)?diagnostico\s*(?:es|fue|identificado)?\b/g,
  },
  {
    campo: "proximaAccion",
    patron:
      /\b(?:la\s+)?proxima\s+accion\s*(?:es|sera|va\s+a\s+ser|seria)?\b|\b(?:el\s+)?compromiso\s*(?:es|fue)?\b/g,
  },
  {
    campo: "observaciones",
    patron:
      /\b(?:las\s+)?observaciones\s*(?:son|fueron|es)?\b|\b(?:la\s+)?observacion\s*(?:es|fue)?\b|\bcomo\s+(?:nota|observacion)\b/g,
  },
  {
    campo: "fechaSeguimiento",
    patron:
      /\b(?:la\s+)?fecha\s+(?:de|del)\s+(?:proximo\s+)?seguimiento\s*(?:es|sera|seria|queda)?\b|\b(?:el\s+)?proximo\s+seguimiento\s*(?:es|sera|seria|queda|lo\s+dejamos)?\b/g,
  },
];

export function interpretarDictado(
  texto: string,
  opciones: {
    productos?: ProductoDictado[];
    clientes?: string[];
    hoy: string;
  },
): ResultadoDictado {
  const plano = normalizar(texto);
  const { segmentos, preambulo } = separarPorMarcadores(texto, plano);

  // Lo que no venía rotulado se reparte por frases, como antes.
  const suelto = repartirPorFrases(preambulo);

  const objetivo = unirSegmentos([suelto.objetivo, segmentos.objetivo]);
  const necesidad = unirSegmentos([suelto.necesidad, segmentos.necesidad]);
  const proximaAccion = unirSegmentos([
    suelto.proximaAccion,
    segmentos.proximaAccion,
  ]);

  // Una fecha dicha junto al rótulo manda sobre cualquier otra del relato:
  // "la otra semana" en el objetivo no debe ganarle a "el 30 de agosto".
  const fechaRotulada = segmentos.fechaSeguimiento
    ? detectarFecha(normalizar(segmentos.fechaSeguimiento), opciones.hoy)
    : null;

  // Si nada se pudo repartir, el dictado entero cae en el objetivo antes que
  // perderse. Pero si algún campo sí recibió texto, un objetivo vacío es
  // correcto: repetirlo dejaría el mismo párrafo en dos casillas.
  const huboReparto = Boolean(
    necesidad || proximaAccion || segmentos.observaciones,
  );

  return {
    objetivo: objetivo || (huboReparto ? "" : texto.trim()),
    necesidad,
    proximaAccion,
    observaciones: segmentos.observaciones,
    tipo: detectarTipo(plano),
    resultado: detectarResultado(plano),
    productos: detectarProductos(plano, opciones.productos ?? []),
    fechaSeguimiento: fechaRotulada ?? detectarFecha(plano, opciones.hoy),
    cliente: detectarCliente(plano, opciones.clientes ?? []),
  };
}

/* ---------------------------- Rótulos de campo --------------------------- */

/**
 * Corta el dictado en los puntos donde se nombra un campo. Devuelve el texto
 * de cada campo y el trozo anterior al primer rótulo, que se reparte aparte.
 */
function separarPorMarcadores(
  texto: string,
  plano: string,
): { segmentos: Record<CampoDictado, string>; preambulo: string } {
  const encontrados: { campo: CampoDictado; inicio: number; fin: number }[] = [];

  for (const { campo, patron } of MARCADORES) {
    for (const coincidencia of plano.matchAll(patron)) {
      if (coincidencia.index === undefined) continue;
      encontrados.push({
        campo,
        inicio: coincidencia.index,
        fin: coincidencia.index + coincidencia[0].length,
      });
    }
  }

  encontrados.sort((a, b) => a.inicio - b.inicio);

  // Dos rótulos solapados (p. ej. "objetivo" dentro de otra frase) : gana el primero.
  const limpios = encontrados.filter(
    (marcador, indice, lista) =>
      indice === 0 || marcador.inicio >= lista[indice - 1].fin,
  );

  const segmentos: Record<CampoDictado, string> = {
    objetivo: "",
    necesidad: "",
    proximaAccion: "",
    observaciones: "",
    fechaSeguimiento: "",
  };

  limpios.forEach((marcador, indice) => {
    const hasta = limpios[indice + 1]?.inicio ?? texto.length;
    const trozo = limpiarSegmento(texto.slice(marcador.fin, hasta));
    if (trozo) {
      segmentos[marcador.campo] = unirSegmentos([
        segmentos[marcador.campo],
        trozo,
      ]);
    }
  });

  const preambulo = limpios[0] ? texto.slice(0, limpios[0].inicio) : texto;

  return { segmentos, preambulo };
}

/** Quita la puntuación y los conectores que quedan pegados tras el rótulo. */
function limpiarSegmento(trozo: string): string {
  const limpio = trozo
    .replace(/^[\s,;:.–—-]+/, "")
    .replace(/^(?:que|de|del|es|son|fue|fueron|sera|seria)\s+/i, "")
    .replace(/^[\s,;:.–—-]+/, "")
    .replace(/[\s,;:]+$/, "")
    // Al cortar en el rótulo siguiente queda colgando la conjunción:
    // "…cotizar el pedido y a organizarlo y" → se le quita esa "y".
    .replace(/\s+(?:y|e|o|u|pero|que)$/i, "")
    .trim();

  if (!limpio) return "";
  return limpio[0].toUpperCase() + limpio.slice(1);
}

function unirSegmentos(partes: string[]): string {
  return partes
    .map((parte) => parte.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

/* --------------------------- Reparto por frases -------------------------- */

function repartirPorFrases(texto: string): {
  objetivo: string;
  necesidad: string;
  proximaAccion: string;
} {
  const { piezas: frases, porComa } = dividirEnPiezas(texto);

  const necesidadIndice = frases.findIndex((frase) =>
    /(necesita|requiere|problema|plaga|hongo|deficiencia|diagnostic|le preocupa|dificultad|quiere mejorar|baja produccion)/.test(
      normalizar(frase),
    ),
  );

  const accionIndice = frases.findIndex(
    (frase, indice) =>
      indice !== necesidadIndice &&
      /(enviar|mandar|agendar|programar|cotizar|volver|llamar|coordinar|entregar|hacer seguimiento|pasar la propuesta|quedamos en)/.test(
        normalizar(frase),
      ),
  );

  const usadas = new Set([necesidadIndice, accionIndice].filter((i) => i >= 0));

  return {
    objetivo: capitalizar(
      frases
        .filter((_, indice) => !usadas.has(indice))
        .join(porComa ? ", " : " "),
    ),
    necesidad: necesidadIndice >= 0 ? capitalizar(frases[necesidadIndice]) : "",
    proximaAccion: accionIndice >= 0 ? capitalizar(frases[accionIndice]) : "",
  };
}

/**
 * Corta en frases. Cuando el dictado viene de un tirón y sin puntos, corta por
 * comas: de lo contrario la única frase caería entera en dos campos a la vez.
 */
function dividirEnPiezas(texto: string): {
  piezas: string[];
  porComa: boolean;
} {
  const frases = texto
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((frase) => frase.trim())
    .filter(Boolean);

  if (frases.length > 1) return { piezas: frases, porComa: false };

  const clausulas = (frases[0] ?? "")
    .split(/,\s+/)
    .map((clausula) => clausula.trim())
    .filter(Boolean);

  return clausulas.length > 1
    ? { piezas: clausulas, porComa: true }
    : { piezas: frases, porComa: false };
}

function capitalizar(texto: string): string {
  const limpio = texto.trim();
  return limpio ? limpio[0].toUpperCase() + limpio.slice(1) : "";
}

/* ------------------------------ Detectores ------------------------------- */

function detectarTipo(plano: string): string | null {
  if (
    /(videollamada|virtual|por teams|por meet|por zoom|videoconferencia)/.test(
      plano,
    )
  ) {
    return "Virtual";
  }
  if (/(llamada|telefonic|por telefono|marque)/.test(plano)) return "Llamada";
  if (
    /(presencial|en campo|en la finca|en la planta|visitamos|fuimos|estuve con|estuvimos con)/.test(
      plano,
    )
  ) {
    return "Presencial";
  }
  return null;
}

function detectarResultado(plano: string): string | null {
  if (
    /(venta cerrada|cerramos la venta|cerro la venta|nos compro|confirmo el pedido)/.test(
      plano,
    )
  ) {
    return "Venta cerrada";
  }
  if (
    /(cotizacion enviada|envie la cotizacion|enviamos la cotizacion|ya tiene la cotizacion)/.test(
      plano,
    )
  ) {
    return "Cotización enviada";
  }
  if (
    /(sin interes|no les? interesa|no esta interesado|no quiere por ahora|nos dijo que no)/.test(
      plano,
    )
  ) {
    return "Sin interés por ahora";
  }
  if (
    /(muy interesado|quedo interesado|le intereso|mostro interes|esta interesado)/.test(
      plano,
    )
  ) {
    return "Interesado";
  }
  if (/(seguimiento|volver a|qued(?:amos|e|o) en|pendiente)/.test(plano)) {
    return "Seguimiento pendiente";
  }
  return null;
}

function detectarProductos(
  plano: string,
  productos: ProductoDictado[],
): string[] {
  // De más largo a más corto para que "Biochar Blend" gane sobre "Biochar".
  const ordenados = [...productos].sort(
    (a, b) => b.nombre.length - a.nombre.length,
  );

  const encontrados: string[] = [];
  let restante = plano;

  for (const producto of ordenados) {
    const nombre = normalizar(producto.nombre).replace(/\s*\((kg|l)\)\s*/g, "");
    if (!nombre || nombre.length < 4) continue;

    if (restante.includes(nombre)) {
      encontrados.push(producto.codigo);
      restante = restante.split(nombre).join(" ");
    }
  }

  return encontrados;
}

/* --------------------------- Cliente aproximado -------------------------- */

const SUFIJOS_LEGALES =
  /\b(s\.?a\.?s?|zomac|ltda|s\.? en c\.?|usuario operador de zona franca)\b/g;

/**
 * Colapsa el nombre a su esqueleto sonoro. Whisper acierta las consonantes
 * mucho más que las vocales ("Guaicaramo" sale como "Huecaramo"), así que
 * las vocales se unifican y las consonantes que suenan igual se agrupan.
 */
function esqueleto(texto: string): string {
  return texto
    .replace(/[^a-z\s]/g, "")
    .replace(/h/g, "")
    .replace(/ll/g, "y")
    .replace(/qu/g, "k")
    .replace(/c([ei])/g, "s$1")
    .replace(/[ckq]/g, "k")
    .replace(/z/g, "s")
    .replace(/v/g, "b")
    .replace(/[aeiou]+/g, "a")
    .replace(/\s+/g, "")
    .replace(/(.)\1+/g, "$1");
}

function distancia(a: string, b: string): number {
  const previa = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let esquina = previa[0];
    previa[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const anterior = previa[j];
      previa[j] = Math.min(
        previa[j] + 1,
        previa[j - 1] + 1,
        esquina + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      esquina = anterior;
    }
  }

  return previa[b.length];
}

function parecido(a: string, b: string): number {
  const largo = Math.max(a.length, b.length);
  return largo === 0 ? 0 : 1 - distancia(a, b) / largo;
}

function detectarCliente(plano: string, clientes: string[]): string | null {
  const candidatos = clientes
    .map((cliente) => ({
      cliente,
      nombre: normalizar(cliente).replace(SUFIJOS_LEGALES, "").trim(),
    }))
    .filter((c) => c.nombre.length >= 4);

  // 1. El nombre aparece tal cual: es lo más confiable, gana el más largo.
  for (const { cliente, nombre } of [...candidatos].sort(
    (a, b) => b.nombre.length - a.nombre.length,
  )) {
    if (plano.includes(nombre)) return cliente;
  }

  // 2. Se busca por sonido, tolerando el error de transcripción.
  const palabras = plano.split(/[^a-z0-9]+/).filter(Boolean);
  let mejor: { cliente: string; puntaje: number } | null = null;

  for (const { cliente, nombre } of candidatos) {
    const clave = esqueleto(nombre);
    if (clave.length < 4) continue;

    for (let inicio = 0; inicio < palabras.length; inicio++) {
      for (let ancho = 1; ancho <= 4 && inicio + ancho <= palabras.length; ancho++) {
        const ventana = esqueleto(palabras.slice(inicio, inicio + ancho).join(""));
        if (Math.abs(ventana.length - clave.length) > clave.length * 0.4) {
          continue;
        }

        const puntaje = parecido(clave, ventana);
        if (puntaje >= 0.82 && (!mejor || puntaje > mejor.puntaje)) {
          mejor = { cliente, puntaje };
        }
      }
    }
  }

  return mejor?.cliente ?? null;
}

/* -------------------------------- Fechas --------------------------------- */

function detectarFecha(plano: string, hoy: string): string | null {
  if (/pasado manana/.test(plano)) return sumarDias(hoy, 2);
  if (/\bmanana\b/.test(plano)) return sumarDias(hoy, 1);

  // "el 30 de agosto de 2026" — el año dicho manda sobre el cálculo.
  const conMes = plano.match(
    /(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de(?:l)?\s+(\d{4}))?/,
  );
  if (conMes) {
    const dia = Number(conMes[1]);
    const mes = MESES.indexOf(conMes[2]) + 1;
    if (conMes[3]) return formatear(Number(conMes[3]), mes, dia);

    const candidata = formatear(Number(hoy.slice(0, 4)), mes, dia);
    return candidata >= hoy
      ? candidata
      : formatear(Number(hoy.slice(0, 4)) + 1, mes, dia);
  }

  // "30/08/2026" o "30-08-2026", como a veces lo transcribe Whisper.
  const numerica = plano.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (numerica) {
    const anio = Number(numerica[3]);
    return formatear(
      anio < 100 ? 2000 + anio : anio,
      Number(numerica[2]),
      Number(numerica[1]),
    );
  }

  const enUnidad = plano.match(
    /en (\d{1,3}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta) (dias?|semanas?|meses|mes)/,
  );
  if (enUnidad) {
    const cantidad = Number(enUnidad[1]) || NUMEROS[enUnidad[1]] || 1;
    const unidad = enUnidad[2];
    if (unidad.startsWith("dia")) return sumarDias(hoy, cantidad);
    if (unidad.startsWith("semana")) return sumarDias(hoy, cantidad * 7);
    return sumarDias(hoy, cantidad * 30);
  }

  if (/(la proxima semana|la otra semana|la semana entrante)/.test(plano)) {
    return sumarDias(hoy, 7);
  }
  if (/(el proximo mes|el mes entrante)/.test(plano)) return sumarDias(hoy, 30);

  const diaSemana = plano.match(
    /(?:el |este |el proximo |proximo )(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/,
  );
  if (diaSemana) {
    return siguienteDiaSemana(hoy, DIAS_SEMANA.indexOf(diaSemana[1]));
  }

  return null;
}

export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return resultado.toISOString().slice(0, 10);
}

function siguienteDiaSemana(hoy: string, objetivo: number): string {
  const [anio, mes, dia] = hoy.split("-").map(Number);
  const actual = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  const diferencia = (objetivo - actual + 7) % 7 || 7;
  return sumarDias(hoy, diferencia);
}

function formatear(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
