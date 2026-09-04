import { redirect } from "next/navigation";

import { listarClientesCompletos, listarContactos } from "@/lib/clientes";
import {
  estaVencidaPorFecha,
  listarCotizaciones,
} from "@/lib/cotizaciones";
import { hoyEnBogota } from "@/lib/crm";
import { filtrarPorAlcance, permisosDe } from "@/lib/permisos";
import { listarProductosActivos } from "@/lib/productos";
import { getSession } from "@/lib/session";
import { Shell } from "../shell";
import { ModuloCotizaciones, type FilaCotizacion } from "./modulo";

// La vigencia de una oferta se mide contra hoy: nunca se sirve cacheada.
export const dynamic = "force-dynamic";

export default async function CotizacionesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [cotizaciones, clientes, contactos, productos] = await Promise.all([
    listarCotizaciones(),
    listarClientesCompletos(),
    listarContactos(),
    listarProductosActivos(),
  ]);

  const permisos = permisosDe(session);
  const mias = filtrarPorAlcance(cotizaciones, permisos, session);
  const hoy = hoyEnBogota();

  const filas: FilaCotizacion[] = mias.map((cotizacion) => ({
    ...cotizacion,
    // El nombre congelado es el que vale; si falta, el serial dice al menos a
    // quién se le emitió.
    clienteNombre:
      cotizacion.cliente ?? cotizacion.idClienteCore ?? "Sin cliente",
    lineas: cotizacion.lineas.map((linea) => ({
      ...linea,
      productoNombre:
        linea.producto ?? linea.idProductoCore ?? "Sin producto",
    })),
    vencida: estaVencidaPorFecha(
      cotizacion.fechaEmision,
      cotizacion.vigenciaDias,
      hoy,
    ),
  }));

  return (
    <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
      <ModuloCotizaciones
        cotizaciones={filas}
        clientes={clientes.filter((c) => c.activo && c.id)}
        contactos={contactos.filter((c) => c.activo)}
        productos={productos}
        sesion={{ idEmpleado: session.idEmpleado, nombre: session.nombre }}
        hoy={hoy}
        permisos={permisos}
      />
    </Shell>
  );
}
