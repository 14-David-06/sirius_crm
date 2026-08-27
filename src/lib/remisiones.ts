import { listarRegistros, texto } from "@/lib/airtable";
import { cachearLectura, ETIQUETAS } from "@/lib/cache";
import { env } from "@/lib/env";

/**
 * Base "Sirius Remisiones Core": el despacho físico de cada pedido.
 *
 * El CRM solo lee. La remisión la crea logística desde otra herramienta, pero
 * guarda el serial del pedido (`SIRIUS-PED-XXXX`), y eso alcanza para que el
 * comercial responda lo único que le preguntan en campo: si ya le llegó.
 */

const CAMPOS_REMISION = {
  id: "ID",
  idCliente: "ID Cliente",
  idPedido: "ID Pedido",
  estado: "Estado",
  responsable: "Responsable Entrega",
  despachado: "Fecha Pedido Despachado",
  recibido: "Fecha Recibido",
  notas: "Notas de Remisión",
} as const;

export type Remision = {
  recordId: string;
  id: string;
  idCliente: string | null;
  /** Serial del pedido al que corresponde; es la llave del cruce. */
  idPedido: string | null;
  estado: string | null;
  responsable: string | null;
  despachado: string | null;
  recibido: string | null;
  notas: string | null;
};

const leerRemisiones = cachearLectura(
  "remisiones",
  ETIQUETAS.remisiones,
  async (): Promise<Remision[]> => {
    const registros = await listarRegistros(
      env.baseRemisiones,
      env.tablaRemisiones,
      { fields: Object.values(CAMPOS_REMISION) },
    );

    return registros.map((registro) => {
      const f = registro.fields;
      return {
        recordId: registro.id,
        id: texto(f[CAMPOS_REMISION.id]) ?? registro.id,
        idCliente: texto(f[CAMPOS_REMISION.idCliente]),
        idPedido: texto(f[CAMPOS_REMISION.idPedido]),
        estado: texto(f[CAMPOS_REMISION.estado]),
        responsable: texto(f[CAMPOS_REMISION.responsable]),
        despachado: texto(f[CAMPOS_REMISION.despachado]),
        recibido: texto(f[CAMPOS_REMISION.recibido]),
        notas: texto(f[CAMPOS_REMISION.notas]),
      };
    });
  },
);

export async function listarRemisiones(): Promise<Remision[]> {
  return leerRemisiones();
}

/** Remisiones de cada pedido, indexadas por su serial SIRIUS-PED-XXXX. */
export async function remisionesPorPedido(): Promise<Map<string, Remision[]>> {
  const remisiones = await listarRemisiones();
  const mapa = new Map<string, Remision[]>();

  for (const remision of remisiones) {
    if (!remision.idPedido) continue;
    const lista = mapa.get(remision.idPedido);
    if (lista) lista.push(remision);
    else mapa.set(remision.idPedido, [remision]);
  }

  return mapa;
}
