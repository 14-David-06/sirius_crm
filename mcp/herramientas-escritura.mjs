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
  hoy,
  limpiar,
  porId,
  resolverCliente,
  resolverProducto,
  respuesta,
} from "./comun.mjs";
import {
  resumirCaso,
  resumirPedido,
  resumirVisita,
} from "./herramientas-lectura.mjs";
import {
  CATEGORIAS_APLICACION,
  ESTADOS_CASO,
  ESTADOS_PEDIDO,
  ESTADOS_PEDIDO_ABIERTOS,
  RESULTADOS_VISITA,
  TIPOS_CASO,
  TIPOS_PQRSF,
  TIPOS_VISITA,
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
}
