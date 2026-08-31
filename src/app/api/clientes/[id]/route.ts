import { NextResponse } from "next/server";

import { ETIQUETAS, invalidar } from "@/lib/cache";
import {
  actualizarCliente,
  cambiarEstadoCliente,
  listarClientesCompletos,
} from "@/lib/clientes";
import { CANAL_OTRO, reconocerCanal } from "@/lib/clientes-comun";
import { permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Corrige la ficha del cliente, o lo activa/inactiva.
 *
 * El maestro de clientes es dato compartido: lo edita quien administra el
 * catálogo, igual que contactos y productos. Nunca se borra un cliente —
 * visitas, casos y pedidos lo referencian por serial.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!permisosDe(session).gestionarCatalogo) {
    return NextResponse.json(
      { error: "Tu nivel de acceso no permite modificar los clientes." },
      { status: 403 },
    );
  }

  const { id } = await params;
  if (!RECORD_ID.test(id)) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  try {
    if (body?.accion === "datos") {
      const nombre = cadena(body.nombre);
      if (!nombre) {
        return NextResponse.json(
          { error: "El nombre del cliente es obligatorio." },
          { status: 400 },
        );
      }

      // Dos clientes con el mismo nombre son indistinguibles en las visitas,
      // que los guardan por nombre cuando no hay serial.
      const repetido = await nombreRepetido(nombre, id);
      if (repetido) {
        return NextResponse.json(
          { error: `Ya existe otro cliente llamado «${nombre}» (${repetido}).` },
          { status: 409 },
        );
      }

      const canalCrudo = cadena(body.comoConocio);
      const comoConocio = reconocerCanal(canalCrudo);
      if (canalCrudo && !comoConocio) {
        return NextResponse.json(
          { error: "El canal por el que nos conoció no es uno de los definidos." },
          { status: 400 },
        );
      }

      // El detalle solo tiene sentido con "Otro"; con cualquier otro canal se
      // descarta para que no quede un texto viejo contradiciendo la opción.
      const detalle = cadena(body.comoConocioDetalle);
      if (comoConocio === CANAL_OTRO && !detalle) {
        return NextResponse.json(
          { error: "Si el canal es «Otro», escribe cuál fue." },
          { status: 400 },
        );
      }

      const vinculacion = cadena(body.vinculacion);
      if (vinculacion && !FECHA.test(vinculacion)) {
        return NextResponse.json(
          { error: "La fecha de vinculación no es válida." },
          { status: 400 },
        );
      }

      const distancia = leerDistancia(body.distanciaBodegaKm);
      if (distancia === "invalido") {
        return NextResponse.json(
          { error: "La distancia a bodega debe ser un número de kilómetros." },
          { status: 400 },
        );
      }

      const actualizado = await actualizarCliente(
        id,
        {
          nombre,
          nit: cadena(body.nit),
          direccion: cadena(body.direccion),
          ciudad: cadena(body.ciudad),
          departamento: cadena(body.departamento),
          coordenadas: cadena(body.coordenadas),
          distanciaBodegaKm: distancia,
          sector: cadena(body.sector),
          segmento: cadena(body.segmento),
          etapa: cadena(body.etapa),
          responsableComercial: cadena(body.responsableComercial),
          vinculacion,
          observaciones: cadena(body.observaciones),
          comoConocio,
          comoConocioDetalle: comoConocio === CANAL_OTRO ? detalle : null,
        },
        session.idEmpleado,
      );

      invalidar(ETIQUETAS.clientes);
      return NextResponse.json({ cliente: actualizado });
    }

    if (body?.accion === "estado") {
      if (typeof body.activo !== "boolean") {
        return NextResponse.json(
          { error: "Indica si el cliente queda activo." },
          { status: 400 },
        );
      }

      const cambiado = await cambiarEstadoCliente(
        id,
        body.activo,
        session.idEmpleado,
      );
      invalidar(ETIQUETAS.clientes);
      return NextResponse.json({ cliente: cambiado });
    }

    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  } catch (error) {
    console.error("actualizar cliente", error);
    return NextResponse.json(
      { error: "No pudimos actualizar el cliente en Airtable." },
      { status: 502 },
    );
  }
}

/** Devuelve el serial del cliente que ya tiene ese nombre, si lo hay. */
async function nombreRepetido(
  nombre: string,
  exceptoRecordId: string,
): Promise<string | null> {
  const clientes = await listarClientesCompletos();
  const buscado = normalizar(nombre);

  const otro = clientes.find(
    (cliente) =>
      cliente.recordId !== exceptoRecordId &&
      normalizar(cliente.nombre) === buscado,
  );

  return otro ? otro.id || otro.recordId : null;
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** El campo admite quedarse vacío; lo que no admite es un texto que no es número. */
function leerDistancia(valor: unknown): number | null | "invalido" {
  if (valor === undefined || valor === null || valor === "") return null;

  const numero = typeof valor === "number" ? valor : Number(String(valor));
  if (!Number.isFinite(numero) || numero < 0) return "invalido";

  return numero;
}

function cadena(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}
