/**
 * Las herramientas que escriben en el CRM.
 *
 * Todas van contra las rutas de API, así que las validaciones —fecha
 * obligatoria, seguimiento con próxima acción, un caso que no puede nacer
 * cerrado, un pedido que no puede saltar de estado— las sigue haciendo el CRM
 * y no se repiten aquí. Lo que sí hace esta capa es lo que le ahorra trabajo a
 * quien la usa: resolver el cliente y los productos por nombre, y al editar,
 * releer el registro para que baste con mandar el campo que cambia (los PATCH
 * de visitas y casos revalidan el registro entero, así que mandar solo un
 * campo lo dejaría sin los demás).
 *
 * `CRM_MCP_SOLO_LECTURA=1` en `.env.local` deja de registrarlas del todo.
 */

import { z } from "zod";

import {
  contiene,
  hoy,
  limpiar,
  porId,
  resolverCliente,
  resolverPersona,
  resolverProducto,
  resolverProyecto,
  respuesta,
} from "./comun.mjs";
import {
  resumirCaso,
  resumirCotizacion,
  resumirPedido,
  resumirProyecto,
  resumirTarea,
  resumirVisita,
} from "./herramientas-lectura.mjs";
import {
  CATEGORIAS_APLICACION,
  ESTADOS_CASO,
  ESTADOS_COTIZACION,
  ESTADOS_COTIZACION_INICIALES,
  FORMAS_PAGO,
  MODALIDADES_ENTREGA,
  ESTADOS_PEDIDO,
  ESTADOS_PEDIDO_ABIERTOS,
  ESTADOS_PROYECTO,
  ESTADOS_TAREA,
  RESULTADOS_VISITA,
  TIPOS_CASO,
  TIPOS_PQRSF,
  TIPOS_VISITA,
  VEREDICTOS_PROYECTO,
} from "./opciones.mjs";

/** Escribe, y no es idempotente: el cliente MCP debería pedir confirmación. */
const ESCRITURA = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

const FECHA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser YYYY-MM-DD");

/** Los códigos y los nombres de los productos, como los guarda una visita. */
async function productosDeVisita(api, referencias) {
  if (!referencias?.length) return {};

  const elegidos = [];
  for (const referencia of referencias) {
    elegidos.push(await resolverProducto(api, referencia));
  }

  return {
    idProductosCore: elegidos.map((producto) => producto.codigo).join(", "),
    productos: elegidos.map((producto) => producto.nombre).join(", "),
  };
}

/** Trae la visita que se va a editar; el PATCH necesita el registro completo. */
async function visitaActual(api, referencia) {
  const { visitas } = await api.obtener("/api/visitas");
  const visita = porId(visitas, referencia);
  if (!visita) {
    throw new Error(
      `No encuentro la visita «${referencia}» entre las que puedes ver. Usa crm_listar_visitas.`,
    );
  }
  return visita;
}

async function casoActual(api, referencia) {
  const { casos } = await api.obtener("/api/casos");
  const caso = porId(casos, referencia);
  if (!caso) {
    throw new Error(
      `No encuentro el caso «${referencia}» entre los que puedes ver. Usa crm_listar_casos.`,
    );
  }
  return caso;
}

async function pedidoActual(api, referencia) {
  const { pedidos } = await api.obtener("/api/pedidos");
  const pedido = porId(pedidos, referencia);
  if (!pedido) {
    throw new Error(
      `No encuentro el pedido «${referencia}» entre los que puedes ver. Usa crm_listar_pedidos.`,
    );
  }
  return pedido;
}

/** Trae la cotizacion que se va a mover de estado. */
async function cotizacionActual(api, referencia) {
  const { cotizaciones } = await api.obtener("/api/cotizaciones");
  const cotizacion = porId(cotizaciones, referencia);
  if (!cotizacion) {
    throw new Error(
      `No encuentro la cotizacion «${referencia}» entre las que puedes ver. Usa crm_listar_cotizaciones.`,
    );
  }
  return cotizacion;
}

/**
 * Los códigos de catálogo de una lista de productos dichos por nombre.
 *
 * Quien no es Admin no puede leer el catálogo (tiene precios), así que ahí no
 * hay cómo resolver un nombre parcial: se mandan tal cual y el CRM los acepta
 * si son el código o el nombre exacto, o dice cuál no reconoce.
 */
async function codigosDeProductos(api, referencias) {
  if (!referencias?.length) return [];
  const codigos = [];
  for (const referencia of referencias) {
    try {
      codigos.push((await resolverProducto(api, referencia)).codigo);
    } catch (error) {
      if (error?.status !== 403) throw error;
      return referencias;
    }
  }
  return codigos;
}

/** Los códigos que el proyecto ya tiene guardados ("A, B" → ["A", "B"]). */
function codigosGuardados(guardados) {
  return (guardados ?? "")
    .split(",")
    .map((codigo) => codigo.trim())
    .filter(Boolean);
}

/** El proyecto completo con sus tareas, leído sin caché. */
async function proyectoActual(api, referencia) {
  const { recordId } = await resolverProyecto(api, referencia);
  const { proyecto, tareas } = await api.obtener(`/api/proyectos/${recordId}`);
  return { actual: proyecto, tareas };
}

/** Una tarea del proyecto por record id, serial o parte del título. */
function elegirTarea(tareas, referencia) {
  const exacta = porId(tareas, referencia);
  if (exacta) return exacta;

  const parciales = tareas.filter((tarea) => contiene(tarea.tarea, referencia));
  if (parciales.length === 1) return parciales[0];
  if (parciales.length === 0) {
    throw new Error(
      `El proyecto no tiene ninguna tarea que coincida con «${referencia}». Usa crm_detalle_proyecto.`,
    );
  }
  const lista = parciales.map((t) => `${t.id} — ${t.tarea}`).join("; ");
  throw new Error(`«${referencia}» coincide con varias tareas: ${lista}. Precisa cuál.`);
}

export function registrarEscritura(servidor, api) {
  const { crear, modificar } = api;

  servidor.registerTool(
    "crm_registrar_visita",
    {
      title: "Registrar una visita",
      description:
        "Deja una visita comercial en el CRM. El cliente se puede dar por nombre o por " +
        "serial. Dos reglas que el CRM exige: si fijas fecha de seguimiento tiene que " +
        "haber próxima acción, y con resultado «Seguimiento pendiente» la fecha de " +
        "seguimiento es obligatoria.",
      inputSchema: {
        cliente: z.string().describe("Serial CL-000X, record id o nombre."),
        fecha: FECHA.describe("Día en que ocurrió la visita."),
        tipo: z.enum(TIPOS_VISITA),
        objetivo: z.string().describe("Para qué se hizo la visita."),
        resultado: z.enum(RESULTADOS_VISITA),
        contactoCodigo: z
          .string()
          .optional()
          .describe("Código de la persona del cliente con quien se hizo."),
        necesidad: z
          .string()
          .optional()
          .describe("Qué necesita el cliente, en sus palabras."),
        productos: z
          .array(z.string())
          .optional()
          .describe("Productos tratados: código, abreviatura o nombre."),
        proximaAccion: z.string().optional(),
        fechaSeguimiento: FECHA.optional(),
        pendientes: z
          .string()
          .optional()
          .describe("Lo que queda abierto sin fecha propia."),
        observaciones: z.string().optional(),
        responsable: z
          .string()
          .optional()
          .describe(
            "Nombre de quien la hizo, si no fue la propia sesión. Solo los niveles con " +
              "alcance de equipo pueden registrar a nombre de otra persona.",
          ),
      },
      annotations: ESCRITURA,
    },
    async ({ cliente: referencia, productos, responsable, contactoCodigo, ...datos }) => {
      const cliente = await resolverCliente(api, referencia);

      const { visita } = await crear(
        "/api/visitas",
        limpiar({
          idClienteCore: cliente.id,
          cliente: cliente.nombre,
          idContactoCore: contactoCodigo,
          responsable,
          ...(await productosDeVisita(api, productos)),
          ...datos,
        }),
      );

      return respuesta({ registrada: resumirVisita(visita) });
    },
  );

  servidor.registerTool(
    "crm_actualizar_visita",
    {
      title: "Corregir una visita",
      description:
        "Cambia campos de una visita ya registrada. Solo hace falta mandar lo que cambia: " +
        "el resto se conserva. El cliente y el responsable no se pueden cambiar aquí — " +
        "una visita a otra empresa es otra visita, y el responsable es la clave con la " +
        "que el CRM decide quién puede editarla.",
      inputSchema: {
        visita: z.string().describe("Serial o record id de la visita."),
        fecha: FECHA.optional(),
        tipo: z.enum(TIPOS_VISITA).optional(),
        objetivo: z.string().optional(),
        resultado: z.enum(RESULTADOS_VISITA).optional(),
        contactoCodigo: z.string().optional(),
        necesidad: z.string().optional(),
        productos: z
          .array(z.string())
          .optional()
          .describe("Reemplaza la lista completa de productos tratados."),
        proximaAccion: z.string().optional(),
        fechaSeguimiento: FECHA.optional(),
        pendientes: z.string().optional(),
        observaciones: z.string().optional(),
      },
      annotations: ESCRITURA,
    },
    async ({ visita: referencia, productos, contactoCodigo, ...cambios }) => {
      const actual = await visitaActual(api, referencia);

      const cuerpo = {
        idContactoCore: contactoCodigo ?? actual.idContactoCore,
        fecha: cambios.fecha ?? actual.fecha,
        tipo: cambios.tipo ?? actual.tipo,
        objetivo: cambios.objetivo ?? actual.objetivo,
        necesidad: cambios.necesidad ?? actual.necesidad,
        resultado: cambios.resultado ?? actual.resultado,
        proximaAccion: cambios.proximaAccion ?? actual.proximaAccion,
        fechaSeguimiento: cambios.fechaSeguimiento ?? actual.fechaSeguimiento,
        pendientes: cambios.pendientes ?? actual.pendientes,
        observaciones: cambios.observaciones ?? actual.observaciones,
        ...(productos
          ? await productosDeVisita(api, productos)
          : {
              idProductosCore: actual.idProductosCore,
              productos: actual.productos,
            }),
      };

      const { visita } = await modificar(
        `/api/visitas/${actual.recordId}`,
        limpiar(cuerpo),
      );

      return respuesta({ actualizada: resumirVisita(visita) });
    },
  );

  servidor.registerTool(
    "crm_gestionar_seguimiento",
    {
      title: "Reprogramar o cerrar un seguimiento",
      description:
        "Mueve la fecha del compromiso de seguimiento de una visita, o lo marca cumplido. " +
        "Al cerrarlo la nota queda en la bitácora de la visita.",
      inputSchema: {
        visita: z.string().describe("Serial o record id de la visita."),
        accion: z
          .enum(["reprogramar", "cumplido"])
          .describe("reprogramar mueve la fecha; cumplido cierra el compromiso."),
        fecha: FECHA.optional().describe("Nueva fecha. Obligatoria al reprogramar."),
        nota: z
          .string()
          .optional()
          .describe("Qué se hizo. Solo al marcar cumplido."),
        observaciones: z
          .string()
          .optional()
          .describe("Reemplaza las observaciones de la visita al cerrar."),
      },
      annotations: ESCRITURA,
    },
    async ({ visita: referencia, accion, fecha, nota, observaciones }) => {
      const actual = await visitaActual(api, referencia);

      if (accion === "reprogramar" && !fecha) {
        throw new Error("Para reprogramar hace falta la nueva fecha.");
      }

      const { visita } = await modificar(
        `/api/visitas/${actual.recordId}/seguimiento`,
        limpiar({ accion, fecha, nota, observaciones }),
      );

      return respuesta({ actualizada: resumirVisita(visita) });
    },
  );

  servidor.registerTool(
    "crm_abrir_caso",
    {
      title: "Abrir un caso PQRSF",
      description:
        "Registra una petición, queja, reclamo, sugerencia o felicitación de un cliente. " +
        "Un caso nuevo solo puede nacer Abierto o En proceso.",
      inputSchema: {
        cliente: z.string().describe("Serial CL-000X, record id o nombre."),
        tipo: z.enum(TIPOS_PQRSF),
        tipoOtroDetalle: z
          .string()
          .optional()
          .describe("Obligatorio si tipo=Otro: de qué se trata."),
        descripcion: z.string().describe("El requerimiento en palabras del cliente."),
        fechaApertura: FECHA.optional().describe("Por defecto, hoy en Bogotá."),
        estado: z.enum(["Abierto", "En proceso"]).optional().describe("Por defecto Abierto."),
        fechaLimite: FECHA.optional().describe("Compromiso de respuesta (SLA)."),
        contactoCodigo: z
          .string()
          .optional()
          .describe("Código de la persona del cliente que lo reportó."),
        seguimiento: z.string().optional().describe("Primera anotación de gestión."),
        observaciones: z.string().optional(),
        visitaOrigen: z
          .string()
          .optional()
          .describe("Record id de la visita en la que salió el tema."),
        responsable: z
          .string()
          .optional()
          .describe("Nombre de quien queda a cargo, si no es la propia sesión."),
      },
      annotations: ESCRITURA,
    },
    async ({
      cliente: referencia,
      contactoCodigo,
      visitaOrigen,
      fechaApertura,
      estado,
      ...datos
    }) => {
      const cliente = await resolverCliente(api, referencia);

      // Si vino un serial de visita en vez del record id, se traduce: el CRM
      // solo acepta el record id en este campo de vínculo.
      let origen = visitaOrigen;
      if (origen && !/^rec[A-Za-z0-9]{14}$/.test(origen)) {
        origen = (await visitaActual(api, origen)).recordId;
      }

      const { caso } = await crear(
        "/api/casos",
        limpiar({
          idClienteCore: cliente.id,
          cliente: cliente.nombre,
          idContactoCore: contactoCodigo,
          fechaApertura: fechaApertura ?? hoy(),
          estado: estado ?? "Abierto",
          visitaOrigen: origen,
          ...datos,
        }),
      );

      return respuesta({ abierto: resumirCaso(caso) });
    },
  );

  servidor.registerTool(
    "crm_actualizar_caso",
    {
      title: "Gestionar un caso",
      description:
        "Mueve el estado de un caso, corrige sus datos o cambia su fecha límite. Para " +
        "resolverlo o cerrarlo el CRM exige la solución que se le dio al cliente: sin " +
        "ella el registro no sirve de nada dentro de un mes.",
      inputSchema: {
        caso: z.string().describe("Serial o record id del caso."),
        accion: z
          .enum(["estado", "datos", "limite"])
          .describe(
            "estado mueve el caso; datos corrige el contenido; limite mueve el plazo.",
          ),
        estado: z.enum(ESTADOS_CASO).optional().describe("Solo con accion=estado."),
        solucionFinal: z
          .string()
          .optional()
          .describe("La respuesta dada al cliente. Obligatoria al resolver o cerrar."),
        fecha: FECHA.optional().describe("Nueva fecha límite. Solo con accion=limite."),
        tipo: z.enum(TIPOS_CASO).optional().describe("Solo con accion=datos."),
        tipoOtroDetalle: z
          .string()
          .optional()
          .describe("Solo con accion=datos. Obligatorio si tipo=Otro."),
        descripcion: z.string().optional().describe("Solo con accion=datos."),
        fechaLimite: FECHA.optional().describe("Solo con accion=datos."),
        contactoCodigo: z.string().optional().describe("Solo con accion=datos."),
        seguimiento: z
          .string()
          .optional()
          .describe("Bitácora de gestión: reemplaza el texto actual."),
        observaciones: z.string().optional(),
      },
      annotations: ESCRITURA,
    },
    async ({ caso: referencia, accion, ...datos }) => {
      const actual = await casoActual(api, referencia);
      let cuerpo;

      if (accion === "estado") {
        if (!datos.estado) {
          throw new Error("Con accion=estado hay que decir a qué estado pasa.");
        }
        cuerpo = {
          accion: "estado",
          estado: datos.estado,
          solucionFinal: datos.solucionFinal,
          observaciones: datos.observaciones,
        };
      } else if (accion === "limite") {
        if (!datos.fecha) {
          throw new Error("Con accion=limite hay que dar la nueva fecha.");
        }
        cuerpo = { accion: "reprogramar", fecha: datos.fecha };
      } else {
        // El PATCH de datos revalida el caso completo, así que lo que no venga
        // se toma del registro actual en vez de borrarse.
        cuerpo = {
          accion: "datos",
          idContactoCore: datos.contactoCodigo ?? actual.idContactoCore,
          tipo: datos.tipo ?? actual.tipo,
          tipoOtroDetalle: datos.tipoOtroDetalle ?? actual.tipoOtroDetalle,
          descripcion: datos.descripcion ?? actual.descripcion,
          fechaLimite: datos.fechaLimite ?? actual.fechaLimite,
          seguimiento: datos.seguimiento ?? actual.seguimiento,
          solucionFinal: datos.solucionFinal ?? actual.solucionFinal,
          observaciones: datos.observaciones ?? actual.observaciones,
        };
      }

      const { caso } = await modificar(
        `/api/casos/${actual.recordId}`,
        limpiar(cuerpo),
      );

      return respuesta({ actualizado: resumirCaso(caso) });
    },
  );

  servidor.registerTool(
    "crm_crear_pedido",
    {
      title: "Registrar un pedido",
      description:
        "Crea un pedido con sus renglones de producto. Si un renglón no trae precio se " +
        "usa el de lista del catálogo; manda 0 explícitamente para una muestra sin costo. " +
        "Un pedido nuevo no puede nacer Completado ni Cancelado.",
      inputSchema: {
        cliente: z.string().describe("Serial CL-000X, record id o nombre."),
        lineas: z
          .array(
            z.object({
              producto: z
                .string()
                .describe("Código SIRIUS-PRODUCT-XXXX, abreviatura o nombre."),
              cantidad: z.number().positive(),
              precioUnitario: z
                .number()
                .min(0)
                .optional()
                .describe("Sin él se toma el precio de lista vigente."),
            }),
          )
          .min(1)
          .max(50),
        fecha: FECHA.optional().describe("Por defecto, hoy en Bogotá."),
        estado: z
          .enum(ESTADOS_PEDIDO_ABIERTOS)
          .optional()
          .describe("Por defecto Recibido."),
        categoriaAplicacion: z.enum(CATEGORIAS_APLICACION).optional(),
        notas: z.string().optional(),
        responsable: z
          .string()
          .optional()
          .describe("Nombre de quien queda a cargo, si no es la propia sesión."),
      },
      annotations: ESCRITURA,
    },
    async ({ cliente: referencia, lineas, fecha, estado, ...datos }) => {
      const cliente = await resolverCliente(api, referencia);

      const renglones = [];
      for (const linea of lineas) {
        const producto = await resolverProducto(api, linea.producto);

        const precio = linea.precioUnitario ?? producto.precio;
        if (precio === null || precio === undefined) {
          throw new Error(
            `«${producto.nombre}» (${producto.codigo}) no tiene precio de lista: indícalo en el renglón.`,
          );
        }

        renglones.push({
          idProductoCore: producto.codigo,
          cantidad: linea.cantidad,
          precioUnitario: precio,
        });
      }

      const { pedido } = await crear(
        "/api/pedidos",
        limpiar({
          idClienteCore: cliente.id,
          fecha: fecha ?? hoy(),
          estado: estado ?? "Recibido",
          lineas: renglones,
          ...datos,
        }),
      );

      return respuesta({ creado: resumirPedido(pedido) });
    },
  );

  servidor.registerTool(
    "crm_cambiar_estado_pedido",
    {
      title: "Mover un pedido de estado",
      description:
        "El único cambio que el CRM hace sobre un pedido ya registrado. Un pedido " +
        "Completado o Cancelado no admite más cambios.",
      inputSchema: {
        pedido: z.string().describe("Serial SIRIUS-PED-XXXX o record id."),
        estado: z.enum(ESTADOS_PEDIDO),
      },
      annotations: ESCRITURA,
    },
    async ({ pedido: referencia, estado }) => {
      const actual = await pedidoActual(api, referencia);

      const { pedido } = await modificar(`/api/pedidos/${actual.recordId}`, {
        estado,
      });

      return respuesta({
        anterior: actual.estado,
        actualizado: resumirPedido(pedido),
      });
    },
  );

  servidor.registerTool(
    "crm_crear_cotizacion",
    {
      title: "Emitir una cotizacion",
      description:
        "Emite una oferta comercial con sus renglones y devuelve el consecutivo " +
        "COT-YYYY-NNN que le asigno el sistema. Si un renglon no trae precio se usa " +
        "el de lista; manda 0 explicitamente para una muestra sin costo. Dejar el IVA " +
        "sin definir NO es cero: el documento lo imprime como «por confirmar», que es " +
        "lo correcto cuando facturacion todavia no lo ha dicho. Una cotizacion nueva " +
        "solo puede nacer en Borrador o Enviada.",
      inputSchema: {
        cliente: z.string().describe("Serial CL-000X, record id o nombre."),
        titulo: z
          .string()
          .describe("De que es la oferta, ej. «Microbiologia agricola»."),
        lineas: z
          .array(
            z.object({
              producto: z
                .string()
                .describe("Codigo SIRIUS-PRODUCT-XXXX, abreviatura o nombre."),
              cantidad: z.number().positive(),
              precioUnitario: z
                .number()
                .min(0)
                .optional()
                .describe("Sin el se toma el precio de lista vigente."),
              descripcion: z
                .string()
                .optional()
                .describe(
                  "Que hace el producto, para la seccion «El producto». Por defecto, las observaciones del catalogo.",
                ),
            }),
          )
          .min(1)
          .max(50),
        contacto: z
          .string()
          .optional()
          .describe(
            "Codigo Persona Cliente del destinatario. Debe pertenecer al mismo cliente.",
          ),
        fechaEmision: FECHA.optional().describe("Por defecto, hoy en Bogota."),
        vigenciaDias: z.number().int().min(1).max(365).optional(),
        estado: z.enum(ESTADOS_COTIZACION_INICIALES).optional(),
        ivaPorcentaje: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Sin el, queda por confirmar con facturacion."),
        introduccion: z.string().optional(),
        modalidadEntrega: z.enum(MODALIDADES_ENTREGA).optional(),
        puntoEntrega: z.string().optional(),
        valorFlete: z.number().min(0).optional(),
        fechaDespacho: FECHA.optional(),
        fechaEntrega: FECHA.optional(),
        quienRecibe: z.string().optional(),
        horarioRecibo: z.string().optional(),
        formaPago: z.enum(FORMAS_PAGO).optional(),
        ordenCompra: z.string().optional(),
        emailFacturacion: z.string().optional(),
        registroIca: z.string().optional(),
        observaciones: z
          .string()
          .optional()
          .describe("Se imprime en el documento: lo lee el cliente."),
        presentacion: z.string().optional(),
        unidades: z.string().optional(),
        almacenamiento: z.string().optional(),
        vidaUtilDias: z.number().positive().optional(),
        notasInternas: z
          .string()
          .optional()
          .describe("NO se imprime en el documento."),
        responsable: z
          .string()
          .optional()
          .describe("Nombre de quien emite, si no es la propia sesion."),
      },
      annotations: ESCRITURA,
    },
    async ({
      cliente: referencia,
      contacto,
      lineas,
      fechaEmision,
      estado,
      ...datos
    }) => {
      const cliente = await resolverCliente(api, referencia);

      const renglones = [];
      for (const linea of lineas) {
        const producto = await resolverProducto(api, linea.producto);

        const precio = linea.precioUnitario ?? producto.precio;
        if (precio === null || precio === undefined) {
          throw new Error(
            `«${producto.nombre}» (${producto.codigo}) no tiene precio de lista: indicalo en el renglon.`,
          );
        }

        renglones.push(
          limpiar({
            idProductoCore: producto.codigo,
            cantidad: linea.cantidad,
            precioUnitario: precio,
            descripcion: linea.descripcion,
          }),
        );
      }

      const { cotizacion } = await crear(
        "/api/cotizaciones",
        limpiar({
          idClienteCore: cliente.id,
          idContactoCliente: contacto,
          fechaEmision: fechaEmision ?? hoy(),
          estado: estado ?? "Borrador",
          lineas: renglones,
          ...datos,
        }),
      );

      return respuesta({ creada: resumirCotizacion(cotizacion) });
    },
  );

  servidor.registerTool(
    "crm_cambiar_estado_cotizacion",
    {
      title: "Mover una cotizacion de estado",
      description:
        "El unico cambio que el CRM hace sobre una cotizacion emitida; el contenido " +
        "no se reescribe. Los saltos no son libres: un Borrador se envia o se anula, " +
        "y solo una Enviada puede pasar a Aceptada o Rechazada. Cerrarla como Aceptada " +
        "o Rechazada exige el motivo: que dijo el cliente.",
      inputSchema: {
        cotizacion: z.string().describe("Consecutivo COT-YYYY-NNN o record id."),
        estado: z.enum(ESTADOS_COTIZACION),
        motivoCierre: z
          .string()
          .optional()
          .describe("Obligatorio al marcarla Aceptada o Rechazada."),
      },
      annotations: ESCRITURA,
    },
    async ({ cotizacion: referencia, estado, motivoCierre }) => {
      const actual = await cotizacionActual(api, referencia);

      const { cotizacion } = await modificar(
        `/api/cotizaciones/${actual.recordId}`,
        limpiar({ estado, motivoCierre }),
      );

      return respuesta({
        anterior: actual.estado,
        actualizada: resumirCotizacion(cotizacion),
      });
    },
  );
  /* ------------------------------ Proyectos ------------------------------ */

  servidor.registerTool(
    "crm_crear_proyecto",
    {
      title: "Crear un proyecto (prueba de campo)",
      description:
        "Abre una prueba de campo de productos Sirius con un cliente. Nace en Planeación " +
        "o En ejecución; después se le agregan las tareas del cronograma con " +
        "crm_gestionar_tarea_proyecto. Queda a nombre de esta sesión salvo que un Admin " +
        "indique otro líder.",
      inputSchema: {
        cliente: z.string().describe("Serial CL-000X, record id o nombre."),
        nombre: z.string().describe("Nombre corto de la prueba."),
        objetivo: z.string().describe("Qué se quiere demostrar."),
        productos: z
          .array(z.string())
          .optional()
          .describe("Productos evaluados, por código o nombre."),
        cultivo: z.string().optional(),
        ubicacion: z.string().optional().describe("Finca, lote o sector."),
        metodologia: z
          .string()
          .optional()
          .describe("Tratamientos, testigo, dosis, área, frecuencia."),
        indicadores: z.string().optional().describe("Qué se mide para decidir."),
        fechaInicio: FECHA.optional().describe("Por defecto, hoy en Bogotá."),
        fechaFinPlaneada: FECHA.optional(),
        estado: z
          .enum(["Planeación", "En ejecución"])
          .optional()
          .describe("Por defecto Planeación."),
        observaciones: z.string().optional(),
        lider: z
          .string()
          .optional()
          .describe("Nombre de quien lo lidera, si no es la propia sesión. Solo Admin."),
      },
      annotations: ESCRITURA,
    },
    async ({ cliente: referencia, productos, lider, fechaInicio, estado, ...datos }) => {
      const cliente = await resolverCliente(api, referencia);
      const codigos = await codigosDeProductos(api, productos);
      const persona = lider ? await resolverPersona(api, lider) : null;

      const { proyecto } = await crear(
        "/api/proyectos",
        limpiar({
          ...datos,
          idClienteCore: cliente.id,
          cliente: cliente.nombre,
          productos: codigos,
          fechaInicio: fechaInicio ?? hoy(),
          estado: estado ?? "Planeación",
          liderId: persona?.idEmpleado,
        }),
      );

      return respuesta({ creado: resumirProyecto(proyecto) });
    },
  );

  servidor.registerTool(
    "crm_actualizar_proyecto",
    {
      title: "Corregir un proyecto o sus resultados",
      description:
        "Cambia los datos de un proyecto o registra sus resultados. Basta con mandar los " +
        "campos que cambian; el resto se conserva. Un texto vacío borra ese campo. " +
        "`productos` reemplaza la lista entera. El estado no se cambia aquí: usa " +
        "crm_cambiar_estado_proyecto.",
      inputSchema: {
        proyecto: z.string().describe("Serial PRY-000X, record id o nombre."),
        nombre: z.string().optional(),
        objetivo: z.string().optional(),
        productos: z.array(z.string()).optional(),
        cultivo: z.string().optional(),
        ubicacion: z.string().optional(),
        metodologia: z.string().optional(),
        indicadores: z.string().optional(),
        fechaInicio: FECHA.or(z.literal("")).optional(),
        fechaFinPlaneada: FECHA.or(z.literal("")).optional(),
        observaciones: z.string().optional(),
        lider: z.string().optional().describe("Nuevo líder. Solo Admin."),
        resultados: z.string().optional().describe("Lo que se midió y observó."),
        veredicto: z.enum(VEREDICTOS_PROYECTO).optional(),
        conclusion: z
          .string()
          .optional()
          .describe("Qué se decide: escalar, repetir, descartar."),
      },
      annotations: ESCRITURA,
    },
    async ({
      proyecto: referencia,
      productos,
      lider,
      resultados,
      veredicto,
      conclusion,
      ...cambios
    }) => {
      const { actual } = await proyectoActual(api, referencia);
      const ruta = `/api/proyectos/${actual.recordId}`;
      let proyecto = actual;

      const tocaDatos =
        productos !== undefined ||
        lider !== undefined ||
        Object.values(cambios).some((valor) => valor !== undefined);

      if (tocaDatos) {
        // El PATCH revalida el proyecto entero: lo que no viene se toma de lo
        // guardado para no borrarlo.
        const conservar = (campo) =>
          cambios[campo] !== undefined ? cambios[campo] : (actual[campo] ?? "");
        const persona = lider ? await resolverPersona(api, lider) : null;

        ({ proyecto } = await modificar(ruta, {
          accion: "datos",
          nombre: conservar("nombre"),
          objetivo: conservar("objetivo"),
          cultivo: conservar("cultivo"),
          ubicacion: conservar("ubicacion"),
          metodologia: conservar("metodologia"),
          indicadores: conservar("indicadores"),
          fechaInicio: conservar("fechaInicio"),
          fechaFinPlaneada: conservar("fechaFinPlaneada"),
          observaciones: conservar("observaciones"),
          productos:
            productos !== undefined
              ? await codigosDeProductos(api, productos)
              : codigosGuardados(actual.idProductosCore),
          liderId: persona?.idEmpleado ?? actual.idPersonalCore,
        }));
      }

      if (
        resultados !== undefined ||
        veredicto !== undefined ||
        conclusion !== undefined
      ) {
        ({ proyecto } = await modificar(ruta, {
          accion: "resultados",
          resultados: resultados ?? actual.resultados ?? "",
          veredicto: veredicto ?? actual.veredicto ?? "",
          conclusion: conclusion ?? actual.conclusion ?? "",
        }));
      }

      if (proyecto === actual) {
        throw new Error("No mandaste ningún campo para cambiar.");
      }

      return respuesta({ actualizado: resumirProyecto(proyecto) });
    },
  );

  servidor.registerTool(
    "crm_cambiar_estado_proyecto",
    {
      title: "Mover el estado de un proyecto",
      description:
        "Planeación → En ejecución → En evaluación → Finalizado, o Cancelado. Finalizar " +
        "exige los resultados medidos y el veredicto, si no estaban ya registrados. " +
        "Finalizar o cancelar sella la fecha de cierre; reabrir la borra.",
      inputSchema: {
        proyecto: z.string().describe("Serial PRY-000X, record id o nombre."),
        estado: z.enum(ESTADOS_PROYECTO),
        resultados: z.string().optional(),
        veredicto: z.enum(VEREDICTOS_PROYECTO).optional(),
        conclusion: z.string().optional(),
      },
      annotations: ESCRITURA,
    },
    async ({ proyecto: referencia, estado, ...cierre }) => {
      const { actual } = await proyectoActual(api, referencia);

      const { proyecto } = await modificar(
        `/api/proyectos/${actual.recordId}`,
        limpiar({ accion: "estado", estado, ...cierre }),
      );

      return respuesta({
        anterior: actual.estado,
        actualizado: resumirProyecto(proyecto),
      });
    },
  );

  servidor.registerTool(
    "crm_anotar_avance_proyecto",
    {
      title: "Anotar un avance en la bitácora del proyecto",
      description:
        "Agrega una línea fechada y firmada a la bitácora de ejecución: lo que se hizo u " +
        "observó en campo. Puede hacerlo el líder o cualquiera con una tarea en el " +
        "proyecto. No se puede editar después.",
      inputSchema: {
        proyecto: z.string().describe("Serial PRY-000X, record id o nombre."),
        nota: z.string().describe("El avance, en una o dos frases."),
      },
      annotations: ESCRITURA,
    },
    async ({ proyecto: referencia, nota }) => {
      const { actual } = await proyectoActual(api, referencia);
      const { proyecto } = await modificar(`/api/proyectos/${actual.recordId}`, {
        accion: "bitacora",
        nota,
      });
      const lineas = proyecto.bitacora?.split(/\r?\n/).filter(Boolean) ?? [];
      return respuesta({ proyecto: proyecto.id, anotado: lineas.at(-1) });
    },
  );

  servidor.registerTool(
    "crm_gestionar_tarea_proyecto",
    {
      title: "Crear, replanear o avanzar una tarea de proyecto",
      description:
        "Las tareas forman el cronograma del proyecto. `crear` y `replanear` (cambiar " +
        "título, encargado o fechas) son del líder o un Admin. `avanzar` mueve el estado " +
        "y las notas, y también lo puede hacer el encargado de la tarea. Completarla sella " +
        "la fecha de hoy.",
      inputSchema: {
        proyecto: z.string().describe("Serial PRY-000X, record id o nombre."),
        accion: z.enum(["crear", "replanear", "avanzar"]),
        tarea: z
          .string()
          .optional()
          .describe(
            "La tarea existente (TAR-000X, record id o parte del título). Para replanear y avanzar.",
          ),
        titulo: z.string().optional().describe("Qué hay que hacer. Obligatorio al crear."),
        descripcion: z.string().optional(),
        encargado: z
          .string()
          .optional()
          .describe("Nombre o ID de empleado. Al crear, por defecto la propia sesión."),
        fechaInicio: FECHA.or(z.literal("")).optional(),
        fechaFin: FECHA.or(z.literal("")).optional(),
        estado: z.enum(ESTADOS_TAREA).optional().describe("Obligatorio al avanzar."),
        notas: z
          .string()
          .optional()
          .describe("Qué resultó o por qué está detenida. Reemplaza las anteriores."),
      },
      annotations: ESCRITURA,
    },
    async ({
      proyecto: referencia,
      accion,
      tarea: refTarea,
      titulo,
      descripcion,
      encargado,
      fechaInicio,
      fechaFin,
      estado,
      notas,
    }) => {
      const { actual, tareas } = await proyectoActual(api, referencia);
      const base = `/api/proyectos/${actual.recordId}/tareas`;
      const persona = encargado ? await resolverPersona(api, encargado) : null;

      if (accion === "crear") {
        if (!titulo) throw new Error("Para crear la tarea hace falta el título.");
        const { tarea } = await crear(
          base,
          limpiar({
            tarea: titulo,
            descripcion,
            encargadoId: persona?.idEmpleado,
            fechaInicio,
            fechaFin,
          }),
        );
        return respuesta({ proyecto: actual.id, creada: resumirTarea(tarea) });
      }

      if (!refTarea) {
        throw new Error("Indica cuál tarea con el parámetro `tarea`.");
      }
      const existente = elegirTarea(tareas, refTarea);

      if (accion === "replanear") {
        const { tarea } = await modificar(`${base}/${existente.recordId}`, {
          accion: "datos",
          tarea: titulo ?? existente.tarea,
          descripcion: descripcion ?? existente.descripcion ?? "",
          encargadoId: persona?.idEmpleado ?? existente.idPersonalCore,
          fechaInicio: fechaInicio ?? existente.fechaInicio ?? "",
          fechaFin: fechaFin ?? existente.fechaFin ?? "",
        });
        return respuesta({ proyecto: actual.id, replaneada: resumirTarea(tarea) });
      }

      if (!estado) throw new Error("Para avanzar la tarea hace falta el estado.");
      const { tarea } = await modificar(
        `${base}/${existente.recordId}`,
        limpiar({ accion: "estado", estado, notas }),
      );
      return respuesta({
        proyecto: actual.id,
        anterior: existente.estado,
        actualizada: resumirTarea(tarea),
      });
    },
  );
}
