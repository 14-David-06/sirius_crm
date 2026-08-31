import { NextResponse } from "next/server";

import {
  crearCaso,
  ESTADOS_CASO,
  estaCerrado,
  listarCasos,
  TIPOS_CASO,
  type EstadoCaso,
  type TipoCaso,
} from "@/lib/casos";
import { esErrorAutoria, resolverAutoria } from "@/lib/autoria";
import { filtrarPorAlcance, permisosDe } from "@/lib/permisos";
import { ETIQUETAS, invalidar } from "@/lib/cache";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permisos = permisosDe(session);

  try {
    const casos = await listarCasos();
    return NextResponse.json({
      casos: filtrarPorAlcance(casos, permisos, session),
    });
  } catch (error) {
    console.error("listar casos", error);
    return NextResponse.json(
      { error: "No pudimos leer los casos." },
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
      { error: "Tu nivel de acceso no permite abrir casos." },
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
  const fechaApertura = cadena(body.fechaApertura);
  const tipo = cadena(body.tipo);
  const descripcion = cadena(body.descripcion);
  const estado = cadena(body.estado);
  const fechaLimite = cadena(body.fechaLimite);
  const visitaOrigen = cadena(body.visitaOrigen);

  if (!cliente) {
    return NextResponse.json({ error: "Elige un cliente." }, { status: 400 });
  }
  if (!fechaApertura || !FECHA.test(fechaApertura)) {
    return NextResponse.json(
      { error: "La fecha de apertura es obligatoria." },
      { status: 400 },
    );
  }
  if (!tipo || !TIPOS_CASO.includes(tipo as TipoCaso)) {
    return NextResponse.json(
      { error: "Tipo de requerimiento inválido." },
      { status: 400 },
    );
  }
  if (!descripcion) {
    return NextResponse.json(
      { error: "Describe el requerimiento del cliente." },
      { status: 400 },
    );
  }
  if (!estado || !ESTADOS_CASO.includes(estado as EstadoCaso)) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }
  // Un caso nuevo se abre para atenderlo; nacer resuelto no tiene sentido.
  if (estaCerrado(estado)) {
    return NextResponse.json(
      { error: "Un caso nuevo debe quedar Abierto o En proceso." },
      { status: 400 },
    );
  }
  if (fechaLimite && !FECHA.test(fechaLimite)) {
    return NextResponse.json(
      { error: "Fecha límite inválida." },
      { status: 400 },
    );
  }
  if (fechaLimite && fechaLimite < fechaApertura) {
    return NextResponse.json(
      { error: "La fecha límite no puede ser anterior a la apertura." },
      { status: 400 },
    );
  }
  if (visitaOrigen && !RECORD_ID.test(visitaOrigen)) {
    return NextResponse.json(
      { error: "Visita de origen inválida." },
      { status: 400 },
    );
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
    const caso = await crearCaso({
      idClienteCore: cadena(body.idClienteCore),
      cliente,
      idContactoCore: cadena(body.idContactoCore) ?? undefined,
      fechaApertura,
      tipo: tipo as TipoCaso,
      descripcion,
      responsable: autoria.responsable,
      idPersonalCore: autoria.idPersonalCore,
      autorId: session.idEmpleado,
      estado: estado as EstadoCaso,
      fechaLimite: fechaLimite ?? undefined,
      seguimiento: cadena(body.seguimiento) ?? undefined,
      observaciones: cadena(body.observaciones) ?? undefined,
      visitaOrigen: visitaOrigen ?? undefined,
    });

    invalidar(ETIQUETAS.casos);
    return NextResponse.json({ caso }, { status: 201 });
  } catch (error) {
    console.error("crear caso", error);
    return NextResponse.json(
      { error: "No pudimos guardar el caso en Airtable." },
      { status: 502 },
    );
  }
}

function cadena(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}
