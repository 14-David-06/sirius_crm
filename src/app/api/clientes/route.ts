import { NextResponse } from "next/server";

import { ETIQUETAS, invalidar } from "@/lib/cache";
import {
  crearCliente,
  esErrorDatosCliente,
  leerDatosCliente,
  listarClientes,
  listarClientesCompletos,
  nombreClienteRepetido,
} from "@/lib/clientes";
import { permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * El maestro de clientes. Existe para los consumidores que no son la propia
 * página —el conector MCP— y repite la regla que ya aplican las pantallas:
 *
 *   - La ficha completa (NIT, etapa, observaciones, auditoría) es dato de
 *     terceros: sin alcance de equipo no se lee, igual que en
 *     `/dashboard/clientes`.
 *   - El selector básico (serial, nombre, ciudad) lo recibe cualquier sesión,
 *     igual que en `/dashboard/visitas`: sin él no se puede ni registrar una
 *     visita a nombre propio.
 *
 * `alcance` en la respuesta dice cuál de las dos vino, para que quien la lea no
 * confunda "el cliente no tiene NIT" con "no puedes ver el NIT".
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permisos = permisosDe(session);
  if (!permisos.leerPropio) {
    return NextResponse.json(
      { error: "Tu usuario no tiene un nivel de acceso asignado." },
      { status: 403 },
    );
  }

  try {
    if (permisos.verTodo) {
      return NextResponse.json({
        alcance: "completo",
        clientes: await listarClientesCompletos(),
      });
    }

    return NextResponse.json({
      alcance: "selector",
      clientes: await listarClientes(),
    });
  } catch (error) {
    console.error("listar clientes", error);
    return NextResponse.json(
      { error: "No pudimos leer los clientes." },
      { status: 502 },
    );
  }
}

/**
 * Registra un cliente nuevo en el maestro.
 *
 * El serial `CL-XXXX` lo genera Airtable, así que no se pide ni se acepta: es
 * lo que después referencian visitas, casos, pedidos y cotizaciones, y un
 * serial escrito a mano se puede repetir.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // El maestro es dato compartido: lo administra quien gestiona el catálogo,
  // igual que contactos y productos.
  if (!permisosDe(session).gestionarCatalogo) {
    return NextResponse.json(
      { error: "Tu nivel de acceso no permite registrar clientes." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  const datos = leerDatosCliente(body);
  if (esErrorDatosCliente(datos)) {
    return NextResponse.json({ error: datos.error }, { status: datos.status });
  }

  try {
    const repetido = await nombreClienteRepetido(datos.nombre);
    if (repetido) {
      return NextResponse.json(
        {
          error: `Ya existe un cliente llamado «${datos.nombre}» (${repetido}).`,
        },
        { status: 409 },
      );
    }

    const cliente = await crearCliente(datos, session.idEmpleado);

    invalidar(ETIQUETAS.clientes);
    return NextResponse.json({ cliente }, { status: 201 });
  } catch (error) {
    console.error("crear cliente", error);
    return NextResponse.json(
      { error: "No pudimos guardar el cliente en Airtable." },
      { status: 502 },
    );
  }
}
