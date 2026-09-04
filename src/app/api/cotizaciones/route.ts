import { NextResponse } from "next/server";

import { esErrorAutoria, resolverAutoria } from "@/lib/autoria";
import { ETIQUETAS, invalidar } from "@/lib/cache";
import { listarClientesCompletos, listarContactos } from "@/lib/clientes";
import {
  crearCotizacion,
  ESTADOS_INICIALES_COTIZACION,
  FORMAS_PAGO,
  listarCotizaciones,
  MODALIDADES_ENTREGA,
  VIGENCIA_POR_DEFECTO,
  type EstadoCotizacion,
  type FormaPago,
  type LineaNuevaCotizacion,
  type ModalidadEntrega,
} from "@/lib/cotizaciones";
import { leerCantidad } from "@/lib/cotizaciones-comun";
import { filtrarPorAlcance, permisosDe } from "@/lib/permisos";
import { listarProductos } from "@/lib/productos";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const SERIAL_CLIENTE = /^CL-\d{3,6}$/;
const SERIAL_PRODUCTO = /^SIRIUS-PRODUCT-\d{3,6}$/;

/** Una oferta no puede quedar en firme para siempre ni por menos de un día. */
const VIGENCIA_MAXIMA_DIAS = 365;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permisos = permisosDe(session);

  try {
    const cotizaciones = await listarCotizaciones();
    return NextResponse.json({
      cotizaciones: filtrarPorAlcance(cotizaciones, permisos, session),
    });
  } catch (error) {
    console.error("listar cotizaciones", error);
    return NextResponse.json(
      { error: "No pudimos leer las cotizaciones." },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permisos = permisosDe(session);
  if (!permisos.crear) {
    return NextResponse.json(
      { error: "Tu nivel de acceso no permite emitir cotizaciones." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const idClienteCore = cadena(body.idClienteCore);
  const titulo = cadena(body.titulo);
  const fechaEmision = cadena(body.fechaEmision);
  const estado = cadena(body.estado);

  if (!idClienteCore || !SERIAL_CLIENTE.test(idClienteCore)) {
    return NextResponse.json(
      { error: "Elige un cliente del catálogo." },
      { status: 400 },
    );
  }
  if (!titulo) {
    return NextResponse.json(
      { error: "La cotización necesita un título: de qué es la oferta." },
      { status: 400 },
    );
  }
  if (!fechaEmision || !FECHA.test(fechaEmision)) {
    return NextResponse.json(
      { error: "La fecha de emisión es obligatoria." },
      { status: 400 },
    );
  }
  if (
    !estado ||
    !ESTADOS_INICIALES_COTIZACION.includes(estado as "Borrador" | "Enviada")
  ) {
    return NextResponse.json(
      {
        error:
          "Una cotización nueva solo puede nacer en Borrador o Enviada: nadie la ha aceptado todavía.",
      },
      { status: 400 },
    );
  }

  const vigenciaDias = entero(body.vigenciaDias, VIGENCIA_POR_DEFECTO);
  if (
    vigenciaDias === "invalido" ||
    vigenciaDias < 1 ||
    vigenciaDias > VIGENCIA_MAXIMA_DIAS
  ) {
    return NextResponse.json(
      {
        error: `La vigencia debe ser un número de días entre 1 y ${VIGENCIA_MAXIMA_DIAS}.`,
      },
      { status: 400 },
    );
  }

  // Vacío es "por confirmar con facturación", que no es lo mismo que 0 %.
  const iva = decimalOpcional(body.ivaPorcentaje);
  if (iva === "invalido" || (iva !== undefined && (iva < 0 || iva > 100))) {
    return NextResponse.json(
      { error: "El IVA debe ser un porcentaje entre 0 y 100, o quedar vacío." },
      { status: 400 },
    );
  }

  const flete = decimalOpcional(body.valorFlete);
  if (flete === "invalido" || (flete !== undefined && flete < 0)) {
    return NextResponse.json(
      { error: "El valor del flete debe ser un número igual o mayor que cero." },
      { status: 400 },
    );
  }

  const vidaUtil = decimalOpcional(body.vidaUtilDias);
  if (vidaUtil === "invalido" || (vidaUtil !== undefined && vidaUtil <= 0)) {
    return NextResponse.json(
      { error: "La vida útil debe ser un número de días mayor que cero." },
      { status: 400 },
    );
  }

  const modalidad = cadena(body.modalidadEntrega);
  if (
    modalidad &&
    !MODALIDADES_ENTREGA.includes(modalidad as ModalidadEntrega)
  ) {
    return NextResponse.json(
      { error: "Modalidad de entrega inválida." },
      { status: 400 },
    );
  }

  const formaPago = cadena(body.formaPago);
  if (formaPago && !FORMAS_PAGO.includes(formaPago as FormaPago)) {
    return NextResponse.json(
      { error: "Forma de pago inválida." },
      { status: 400 },
    );
  }

  for (const [campo, valor] of [
    ["de despacho", cadena(body.fechaDespacho)],
    ["de entrega", cadena(body.fechaEntrega)],
  ] as const) {
    if (valor && !FECHA.test(valor)) {
      return NextResponse.json(
        { error: `La fecha ${campo} debe ser YYYY-MM-DD.` },
        { status: 400 },
      );
    }
  }

  // La cotización queda a nombre de alguien igual que una visita o un pedido.
  const autoria = await resolverAutoria(session, permisos, {
    id: cadena(body.responsableId),
    nombre: cadena(body.responsable),
  });
  if (esErrorAutoria(autoria)) {
    return NextResponse.json(
      { error: autoria.error },
      { status: autoria.status },
    );
  }

  /*
   * Lo que se congela en el documento —razón social, NIT, contacto, nombres y
   * unidades de producto— se resuelve aquí contra los maestros y nunca se
   * acepta del cliente. Es lo que se imprime y lo que identifica legalmente al
   * destinatario: si viniera del navegador, cualquiera podría emitir una oferta
   * en firme a nombre de otra empresa.
   */
  let clientes;
  let contactos;
  let catalogo;
  try {
    [clientes, contactos, catalogo] = await Promise.all([
      listarClientesCompletos(),
      listarContactos(),
      listarProductos(),
    ]);
  } catch (error) {
    console.error("leer maestros para cotizacion", error);
    return NextResponse.json(
      { error: "No pudimos leer los maestros de cliente y producto." },
      { status: 502 },
    );
  }

  const cliente = clientes.find((c) => c.id === idClienteCore);
  if (!cliente) {
    return NextResponse.json(
      { error: "Ese cliente no está en Sirius Clients Core." },
      { status: 400 },
    );
  }

  const codigoContacto = cadena(body.idContactoCliente);
  const contacto = codigoContacto
    ? contactos.find((c) => c.codigo === codigoContacto)
    : undefined;
  if (codigoContacto && !contacto) {
    return NextResponse.json(
      { error: "Ese contacto no está en el maestro del cliente." },
      { status: 400 },
    );
  }
  // Dirigir la oferta al contacto de otra empresa es un error de digitación que
  // solo se ve cuando ya está impresa.
  if (contacto && !contacto.clientes.includes(cliente.recordId)) {
    return NextResponse.json(
      { error: "Ese contacto no pertenece al cliente de la cotización." },
      { status: 400 },
    );
  }

  const lineas = leerLineas(body.lineas, catalogo);
  if (typeof lineas === "string") {
    return NextResponse.json({ error: lineas }, { status: 400 });
  }

  try {
    const cotizacion = await crearCotizacion({
      idClienteCore,
      cliente: cliente.nombre,
      nitCliente: cliente.nit ?? undefined,
      idContactoCliente: contacto?.codigo ?? undefined,
      contacto: contacto?.nombre,
      cargoContacto: contacto?.cargo ?? undefined,
      idPersonalCore: autoria.idPersonalCore,
      responsable: autoria.responsable,
      titulo,
      introduccion: cadena(body.introduccion) ?? undefined,
      fechaEmision,
      vigenciaDias,
      estado: estado as EstadoCotizacion,
      ivaPorcentaje: iva,
      modalidadEntrega: (modalidad as ModalidadEntrega) ?? undefined,
      puntoEntrega: cadena(body.puntoEntrega) ?? undefined,
      valorFlete: flete,
      fechaDespacho: cadena(body.fechaDespacho) ?? undefined,
      fechaEntrega: cadena(body.fechaEntrega) ?? undefined,
      quienRecibe: cadena(body.quienRecibe) ?? undefined,
      horarioRecibo: cadena(body.horarioRecibo) ?? undefined,
      formaPago: (formaPago as FormaPago) ?? undefined,
      ordenCompra: cadena(body.ordenCompra) ?? undefined,
      emailFacturacion: cadena(body.emailFacturacion) ?? undefined,
      registroIca: cadena(body.registroIca) ?? undefined,
      observaciones: cadena(body.observaciones) ?? undefined,
      presentacion: cadena(body.presentacion) ?? undefined,
      unidades: cadena(body.unidades) ?? undefined,
      almacenamiento: cadena(body.almacenamiento) ?? undefined,
      vidaUtilDias: vidaUtil,
      notasInternas: cadena(body.notasInternas) ?? undefined,
      lineas,
    });

    invalidar(ETIQUETAS.cotizaciones);
    return NextResponse.json({ cotizacion }, { status: 201 });
  } catch (error) {
    console.error("crear cotizacion", error);
    // Si la cabecera se creó y falló un renglón, el mensaje trae el consecutivo.
    const mensaje =
      error instanceof Error && error.message.includes("COT-")
        ? error.message
        : "No pudimos guardar la cotización en Airtable.";
    invalidar(ETIQUETAS.cotizaciones);
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }
}

type ProductoCatalogo = {
  codigo: string;
  nombre: string;
  unidad: string | null;
  tipo: string | null;
  observaciones: string | null;
  activo: boolean;
};

/**
 * Valida los renglones y les pone el nombre, la unidad y la ficha del
 * catálogo. Devuelve el mensaje de error si algo falla.
 *
 * El precio sí viene del formulario: es lo que se negoció, no lo que dice la
 * lista. El nombre no, por lo mismo que no viene el del cliente.
 */
function leerLineas(
  valor: unknown,
  catalogo: ProductoCatalogo[],
): LineaNuevaCotizacion[] | string {
  if (!Array.isArray(valor) || valor.length === 0) {
    return "Agrega al menos un producto a la cotización.";
  }
  if (valor.length > 50) {
    return "Una cotización no puede tener más de 50 renglones.";
  }

  const porCodigo = new Map(catalogo.map((p) => [p.codigo, p]));
  const lineas: LineaNuevaCotizacion[] = [];
  const vistos = new Set<string>();

  for (const crudo of valor) {
    if (typeof crudo !== "object" || crudo === null) {
      return "Renglón inválido.";
    }
    const item = crudo as Record<string, unknown>;

    const idProductoCore = cadena(item.idProductoCore);
    if (!idProductoCore || !SERIAL_PRODUCTO.test(idProductoCore)) {
      return "Cada renglón debe apuntar a un producto del catálogo.";
    }
    if (vistos.has(idProductoCore)) {
      return "Hay un producto repetido: súmalo en un solo renglón.";
    }
    vistos.add(idProductoCore);

    const producto = porCodigo.get(idProductoCore);
    if (!producto) {
      return `El producto ${idProductoCore} no está en Sirius Product Core.`;
    }
    // Ofertar algo descontinuado compromete a Sirius con lo que ya no produce.
    if (!producto.activo) {
      return `«${producto.nombre}» está descontinuado y no se puede cotizar.`;
    }

    const cantidad = leerCantidad(item.cantidad);
    if (cantidad === "invalido") {
      return "La cantidad de cada renglón debe ser mayor que cero.";
    }

    // El precio admite cero: las muestras comerciales van sin costo.
    const precio =
      typeof item.precioUnitario === "number"
        ? item.precioUnitario
        : Number(String(item.precioUnitario ?? ""));
    if (!Number.isFinite(precio) || precio < 0) {
      return "El precio de cada renglón debe ser un número igual o mayor que cero.";
    }

    lineas.push({
      idProductoCore,
      producto: producto.nombre,
      descripcion:
        cadena(item.descripcion) ?? producto.observaciones ?? undefined,
      fichaTecnica: cadena(item.fichaTecnica) ?? producto.tipo ?? undefined,
      cantidad,
      unidad: producto.unidad ?? undefined,
      precioUnitario: precio,
    });
  }

  return lineas;
}

function cadena(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/** Un entero con valor por defecto cuando el campo no viene. */
function entero(valor: unknown, porDefecto: number): number | "invalido" {
  if (valor === undefined || valor === null || valor === "") return porDefecto;

  const numero = typeof valor === "number" ? valor : Number(String(valor));
  if (!Number.isInteger(numero)) return "invalido";

  return numero;
}

/** Un número opcional: `undefined` cuando viene vacío, que no es cero. */
function decimalOpcional(valor: unknown): number | undefined | "invalido" {
  if (valor === undefined || valor === null || valor === "") return undefined;

  const numero = typeof valor === "number" ? valor : Number(String(valor));
  if (!Number.isFinite(numero)) return "invalido";

  return numero;
}
