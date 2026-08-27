/**
 * Interpreta un dictado libre de una visita y reparte el texto en los campos
 * del formulario. Es heurístico a propósito: no llama a ningún modelo, solo
 * busca las señales que el equipo comercial usa al hablar. Todo lo que
 * proponga queda visible y editable antes de guardar.
 */

export type ProductoDictado = { codigo: string; nombre: string };

export type ResultadoDictado = {
  objetivo: string;
  necesidad: string;
  proximaAccion: string;
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

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function interpretarDictado(
  texto: string,
  opciones: {
    productos?: ProductoDictado[];
    clientes?: string[];
    hoy: string;
  },
): ResultadoDictado {
  const plano = normalizar(texto);
  const frases = dividirEnFrases(texto);

  const necesidadIndice = frases.findIndex((frase) =>
    /(necesita|requiere|problema|plaga|hongo|deficiencia|diagnostic|le preocupa|dificultad|quiere mejorar|baja produccion)/.test(
      normalizar(frase),
    ),
  );

  const accionIndice = frases.findIndex((frase) =>
    /(enviar|mandar|agendar|programar|cotizar|volver|llamar|coordinar|entregar|hacer seguimiento|pasar la propuesta|quedamos en)/.test(
      normalizar(frase),
    ),
  );

  const usadas = new Set([necesidadIndice, accionIndice].filter((i) => i >= 0));
  const objetivo = frases
    .filter((_, indice) => !usadas.has(indice))
    .join(" ")
    .trim();

  return {
    objetivo: objetivo || texto.trim(),
    necesidad: necesidadIndice >= 0 ? frases[necesidadIndice].trim() : "",
    proximaAccion: accionIndice >= 0 ? frases[accionIndice].trim() : "",
    tipo: detectarTipo(plano),
    resultado: detectarResultado(plano),
    productos: detectarProductos(plano, opciones.productos ?? []),
    fechaSeguimiento: detectarFecha(plano, opciones.hoy),
    cliente: detectarCliente(plano, opciones.clientes ?? []),
  };
}

function dividirEnFrases(texto: string): string[] {
  return texto
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((frase) => frase.trim())
    .filter(Boolean);
}

function detectarTipo(plano: string): string | null {
  if (/(videollamada|virtual|por teams|por meet|por zoom|videoconferencia)/.test(plano)) {
    return "Virtual";
  }
  if (/(llamada|telefonic|por telefono|marque)/.test(plano)) return "Llamada";
  if (/(presencial|en campo|en la finca|en la planta|visitamos|fuimos)/.test(plano)) {
    return "Presencial";
  }
  return null;
}

function detectarResultado(plano: string): string | null {
  if (/(venta cerrada|cerramos la venta|cerro la venta|nos compro|confirmo el pedido)/.test(plano)) {
    return "Venta cerrada";
  }
  if (/(cotizacion enviada|envie la cotizacion|enviamos la cotizacion|ya tiene la cotizacion)/.test(plano)) {
    return "Cotización enviada";
  }
  if (/(sin interes|no le interesa|no esta interesado|no quiere por ahora|nos dijo que no)/.test(plano)) {
    return "Sin interés por ahora";
  }
  if (/(muy interesado|quedo interesado|le intereso|mostro interes|esta interesado)/.test(plano)) {
    return "Interesado";
  }
  if (/(seguimiento|volver a|quedamos en|pendiente)/.test(plano)) {
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

function detectarCliente(plano: string, clientes: string[]): string | null {
  const ordenados = [...clientes].sort((a, b) => b.length - a.length);

  for (const cliente of ordenados) {
    const nombre = normalizar(cliente)
      .replace(/\b(s\.?a\.?s?|zomac|ltda|s\.? en c\.?|usuario operador de zona franca)\b/g, "")
      .trim();
    if (nombre.length < 4) continue;
    if (plano.includes(nombre)) return cliente;
  }

  return null;
}

function detectarFecha(plano: string, hoy: string): string | null {
  if (/pasado manana/.test(plano)) return sumarDias(hoy, 2);
  if (/\bmanana\b/.test(plano)) return sumarDias(hoy, 1);

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
  if (diaSemana) return siguienteDiaSemana(hoy, DIAS_SEMANA.indexOf(diaSemana[1]));

  const fechaExacta = plano.match(
    /(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/,
  );
  if (fechaExacta) {
    const dia = Number(fechaExacta[1]);
    const mes = MESES.indexOf(fechaExacta[2]) + 1;
    const anio = Number(hoy.slice(0, 4));
    const candidata = formatear(anio, mes, dia);
    return candidata >= hoy ? candidata : formatear(anio + 1, mes, dia);
  }

  return null;
}

/* ------------------------------- Fechas --------------------------------- */

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
