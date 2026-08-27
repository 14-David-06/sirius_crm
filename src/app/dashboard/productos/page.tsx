import { redirect } from "next/navigation";

import { listarVisitas } from "@/lib/crm";
import { listarProductos } from "@/lib/productos";
import { permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";
import { Shell } from "../shell";
import { SinAcceso } from "../sin-acceso";
import { ModuloProductos } from "./modulo";

// El catálogo se edita desde esta misma vista: siempre se lee fresco.
export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // El maestro es dato de terceros: sin alcance de equipo no se lee siquiera.
  const permisos = permisosDe(session);
  if (!permisos.verTodo) {
    return (
      <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
        <SinAcceso modulo="Productos" permisos={permisos} />
      </Shell>
    );
  }

  const [productos, visitas] = await Promise.all([
    listarProductos(),
    listarVisitas(),
  ]);

  /**
   * Cuántas visitas mencionan cada producto.
   *
   * Lo exacto es el código: el formulario de visitas guarda los códigos
   * separados por comas en "ID Productos Core". Pero las visitas anteriores al
   * módulo tienen ese campo vacío y los productos escritos a mano en texto
   * libre, así que ahí se cruza por nombre normalizado — es aproximado y solo
   * reconoce el nombre tal como está en el catálogo.
   */
  const interes = new Map<string, number>();

  for (const visita of visitas) {
    const codigos = new Set(
      (visita.idProductosCore ?? "")
        .split(",")
        .map((codigo) => codigo.trim())
        .filter(Boolean),
    );
    const libre = normalizar(visita.productos ?? "");

    for (const producto of productos) {
      const nombre = normalizar(producto.nombre);
      const mencionado =
        codigos.has(producto.codigo) ||
        (libre !== "" && nombre.length > 3 && libre.includes(nombre));

      if (mencionado) {
        interes.set(producto.codigo, (interes.get(producto.codigo) ?? 0) + 1);
      }
    }
  }

  const filas = productos.map((producto) => ({
    ...producto,
    visitas: interes.get(producto.codigo) ?? 0,
  }));

  return (
    <Shell nombre={session.nombre} rol={session.rol} permisos={permisos}>
      <ModuloProductos filas={filas} />
    </Shell>
  );
}

/** Sin acentos, minúsculas y sin puntuación, para comparar nombres a mano. */
function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
