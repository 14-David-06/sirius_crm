import { NextResponse } from "next/server";

import {
  crearVisita,
  esErrorVisita,
  listarVisitas,
  revisarVisita,
} from "@/lib/crm";
import { esErrorAutoria, resolverAutoria } from "@/lib/autoria";
import { filtrarPorAlcance, permisosDe } from "@/lib/permisos";
import { ETIQUETAS, invalidar } from "@/lib/cache";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permisos = permisosDe(session);

  try {
    const visitas = await listarVisitas();
    return NextResponse.json({
      visitas: filtrarPorAlcance(visitas, permisos, session),
    });
  } catch (error) {
    console.error("listar visitas", error);
    return NextResponse.json(
      { error: "No pudimos leer las visitas." },
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
      { error: "Tu nivel de acceso no permite registrar visitas." },
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

  const cliente = cadena(body.cliente);
  const fecha = cadena(body.fecha);
  const objetivo = cadena(body.objetivo);
  const tipo = cadena(body.tipo);
  const resultado = cadena(body.resultado);
  const proximaAccion = cadena(body.proximaAccion);
  const fechaSeguimiento = cadena(body.fechaSeguimiento);

  if (!cliente) {
    return NextResponse.json({ error: "Elige un cliente." }, { status: 400 });
  }

  // Las mismas reglas que al editar; viven en `crm-comun` para no duplicarse.
  const revisada = revisarVisita({
    fecha,
    objetivo,
    tipo,
    resultado,
    proximaAccion,
    fechaSeguimiento,
  });
  if (esErrorVisita(revisada)) {
    return NextResponse.json({ error: revisada.error }, { status: 400 });
  }

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

  try {
    const visita = await crearVisita({
      idClienteCore: cadena(body.idClienteCore),
      cliente,
      idContactoCore: cadena(body.idContactoCore) ?? undefined,
      fecha: revisada.datos.fecha,
      responsable: autoria.responsable,
      idPersonalCore: autoria.idPersonalCore,
      autorId: session.idEmpleado,
      tipo: revisada.datos.tipo,
      objetivo: revisada.datos.objetivo,
      necesidad: cadena(body.necesidad) ?? undefined,
      idProductosCore: cadena(body.idProductosCore) ?? undefined,
      productos: cadena(body.productos) ?? undefined,
      resultado: revisada.datos.resultado,
      proximaAccion: revisada.datos.proximaAccion ?? undefined,
      fechaSeguimiento: revisada.datos.fechaSeguimiento ?? undefined,
      pendientes: cadena(body.pendientes) ?? undefined,
      observaciones: cadena(body.observaciones) ?? undefined,
    });

    invalidar(ETIQUETAS.visitas);
    return NextResponse.json({ visita }, { status: 201 });
  } catch (error) {
    console.error("crear visita", error);
    return NextResponse.json(
      { error: "No pudimos guardar la visita en Airtable." },
      { status: 502 },
    );
  }
}

function cadena(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}
