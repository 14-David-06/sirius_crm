import { NextResponse } from "next/server";

import {
  crearVisita,
  listarVisitas,
  RESULTADOS_VISITA,
  TIPOS_VISITA,
  type ResultadoVisita,
  type TipoVisita,
} from "@/lib/crm";
import { esErrorAutoria, resolverAutoria } from "@/lib/autoria";
import { filtrarPorAlcance, permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

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
  if (!fecha || !FECHA.test(fecha)) {
    return NextResponse.json(
      { error: "La fecha de la visita es obligatoria." },
      { status: 400 },
    );
  }
  if (!objetivo) {
    return NextResponse.json(
      { error: "Describe el objetivo de la visita." },
      { status: 400 },
    );
  }
  if (!tipo || !TIPOS_VISITA.includes(tipo as TipoVisita)) {
    return NextResponse.json(
      { error: "Tipo de visita inválido." },
      { status: 400 },
    );
  }
  if (!resultado || !RESULTADOS_VISITA.includes(resultado as ResultadoVisita)) {
    return NextResponse.json({ error: "Resultado inválido." }, { status: 400 });
  }
  if (fechaSeguimiento && !FECHA.test(fechaSeguimiento)) {
    return NextResponse.json(
      { error: "Fecha de seguimiento inválida." },
      { status: 400 },
    );
  }
  // La regla del archivo de Excel: si queda seguimiento pendiente,
  // tiene que existir una próxima acción con fecha.
  if (fechaSeguimiento && !proximaAccion) {
    return NextResponse.json(
      { error: "Si agendas un seguimiento, escribe la próxima acción." },
      { status: 400 },
    );
  }
  if (resultado === "Seguimiento pendiente" && !fechaSeguimiento) {
    return NextResponse.json(
      {
        error:
          "Con resultado 'Seguimiento pendiente' debes fijar la fecha del próximo seguimiento.",
      },
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
    const visita = await crearVisita({
      idClienteCore: cadena(body.idClienteCore),
      cliente,
      fecha,
      responsable: autoria.responsable,
      idPersonalCore: autoria.idPersonalCore,
      autorId: session.idEmpleado,
      tipo: tipo as TipoVisita,
      objetivo,
      necesidad: cadena(body.necesidad) ?? undefined,
      idProductosCore: cadena(body.idProductosCore) ?? undefined,
      productos: cadena(body.productos) ?? undefined,
      resultado: resultado as ResultadoVisita,
      proximaAccion: proximaAccion ?? undefined,
      fechaSeguimiento: fechaSeguimiento ?? undefined,
      observaciones: cadena(body.observaciones) ?? undefined,
    });

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
