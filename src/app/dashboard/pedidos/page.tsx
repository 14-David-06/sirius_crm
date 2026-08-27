import { redirect } from "next/navigation";

import { listarPersonalActivo } from "@/lib/airtable";
import { listarClientesCompletos } from "@/lib/clientes";
import { hoyEnBogota } from "@/lib/crm";
import { conResponsables, listarPedidos } from "@/lib/pedidos";
import { filtrarPorAlcance, permisosDe } from "@/lib/permisos";
import { listarProductosActivos } from "@/lib/productos";
import { remisionesPorPedido } from "@/lib/remisiones";
import { getSession } from "@/lib/session";
import { Shell } from "../shell";
import { ModuloPedidos, type FilaPedido } from "./modulo";

// El estado de un pedido cambia durante el día: nunca se sirve cacheado.
export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [pedidos, clientes, productos, personal, remisiones] =
    await Promise.all([
      listarPedidos(),
      listarClientesCompletos(),
      listarProductosActivos(),
      listarPersonalActivo(),
      remisionesPorPedido(),
    ]);

  const permisos = permisosDe(session);

  // El nombre del responsable no vive en la tabla de pedidos, solo su ID.
  const conNombre = conResponsables(pedidos, personal);
  const mios = filtrarPorAlcance(conNombre, permisos, session);

  // Los seriales son la moneda de cambio entre bases; aquí se vuelven nombres.
  const nombreCliente = new Map(clientes.map((c) => [c.id, c.nombre]));
  const nombreProducto = new Map(productos.map((p) => [p.codigo, p.nombre]));
  const unidadProducto = new Map(productos.map((p) => [p.codigo, p.unidad]));

  const filas: FilaPedido[] = mios.map((pedido) => {
    const entregas = remisiones.get(pedido.id) ?? [];

    return {
      ...pedido,
      cliente: pedido.idClienteCore
        ? (nombreCliente.get(pedido.idClienteCore) ?? pedido.idClienteCore)
        : "Sin cliente",
      lineas: pedido.lineas.map((linea) => ({
        ...linea,
        producto: linea.idProductoCore
          ? (nombreProducto.get(linea.idProductoCore) ?? linea.idProductoCore)
          : "Sin producto",
        unidad: linea.idProductoCore
          ? (unidadProducto.get(linea.idProductoCore) ?? null)
          : null,
      })),
      remisiones: entregas.map((remision) => ({
        id: remision.id,
        estado: remision.estado,
        responsable: remision.responsable,
        despachado: remision.despachado,
        recibido: remision.recibido,
      })),
    };
  });

  // Registrar a nombre de otra persona exige alcance de equipo.
  const elegibles = permisos.verTodo
    ? personal
    : personal.filter((p) => p.idEmpleado === session.idEmpleado);

  return (
    <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
      <ModuloPedidos
        pedidos={filas}
        clientes={clientes.filter((c) => c.activo && c.id)}
        productos={productos}
        personal={elegibles}
        sesion={{ idEmpleado: session.idEmpleado, nombre: session.nombre }}
        hoy={hoyEnBogota()}
        permisos={permisos}
      />
    </Shell>
  );
}
