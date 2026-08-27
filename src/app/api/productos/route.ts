import { NextResponse } from "next/server";

import {
  AREAS_PRODUCTO,
  CATEGORIAS_CP_CN,
  CATEGORIAS_PRODUCTO,
  crearProducto,
  leerPrecio,
  listarProductos,
  TIPOS_PRODUCTO,
  UNIDADES_PRODUCTO,
  type AreaProducto,
  type CategoriaCpCn,
  type CategoriaProducto,
  type TipoProducto,
  type UnidadProducto,
} from "@/lib/productos";
import { permisosDe } from "@/lib/permisos";
import { ETIQUETAS, invalidar } from "@/lib/cache";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!permisosDe(session).verTodo) {
    return NextResponse.json(
      { error: "Tu nivel de acceso no permite consultar el catálogo." },
      { status: 403 },
    );
  }

  try {
    return NextResponse.json({ productos: await listarProductos() });
  } catch (error) {
    console.error("listar productos", error);
    return NextResponse.json(
      { error: "No pudimos leer el catálogo." },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!permisosDe(session).gestionarCatalogo) {
    return NextResponse.json(
      { error: "Tu nivel de acceso no permite modificar el catálogo." },
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

  const nombre = cadena(body.nombre);
  const categoria = cadena(body.categoria);
  const tipo = cadena(body.tipo);
  const unidad = cadena(body.unidad);
  const categoriaCpCn = cadena(body.categoriaCpCn);
  const area = cadena(body.area);

  if (!nombre) {
    return NextResponse.json(
      { error: "Escribe el nombre comercial del producto." },
      { status: 400 },
    );
  }
  if (!categoria || !CATEGORIAS_PRODUCTO.includes(categoria as CategoriaProducto)) {
    return NextResponse.json(
      { error: "Categoría de producto inválida." },
      { status: 400 },
    );
  }
  if (!tipo || !TIPOS_PRODUCTO.includes(tipo as TipoProducto)) {
    return NextResponse.json(
      { error: "Tipo de producto inválido." },
      { status: 400 },
    );
  }
  if (!unidad || !UNIDADES_PRODUCTO.includes(unidad as UnidadProducto)) {
    return NextResponse.json(
      { error: "Unidad base inválida." },
      { status: 400 },
    );
  }
  if (categoriaCpCn && !CATEGORIAS_CP_CN.includes(categoriaCpCn as CategoriaCpCn)) {
    return NextResponse.json(
      { error: "Clasificación CP/CN inválida." },
      { status: 400 },
    );
  }
  if (area && !AREAS_PRODUCTO.includes(area as AreaProducto)) {
    return NextResponse.json({ error: "Área inválida." }, { status: 400 });
  }

  const precio = leerPrecio(body.precio);
  if (precio === "invalido") {
    return NextResponse.json(
      { error: "El precio debe ser un número igual o mayor que cero." },
      { status: 400 },
    );
  }

  try {
    const producto = await crearProducto({
      nombre,
      autorId: session.idEmpleado,
      categoria: categoria as CategoriaProducto,
      tipo: tipo as TipoProducto,
      unidad: unidad as UnidadProducto,
      abreviatura: cadena(body.abreviatura) ?? undefined,
      categoriaCpCn: (categoriaCpCn as CategoriaCpCn) ?? undefined,
      area: (area as AreaProducto) ?? undefined,
      version: cadena(body.version) ?? undefined,
      precio: precio ?? undefined,
      observaciones: cadena(body.observaciones) ?? undefined,
    });

    invalidar(ETIQUETAS.productos);
    return NextResponse.json({ producto }, { status: 201 });
  } catch (error) {
    console.error("crear producto", error);
    return NextResponse.json(
      { error: "No pudimos guardar el producto en Airtable." },
      { status: 502 },
    );
  }
}

function cadena(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}
