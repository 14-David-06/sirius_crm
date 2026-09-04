import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { listarPersonalActivo } from "@/lib/airtable";
import {
  EMISOR,
  formatearCantidad,
  formatearFechaLarga,
  formatearPesos,
  formatearRevision,
  formatearVigencia,
  NOTA_MODALIDAD,
  obtenerCotizacion,
  textoLegal,
  type LineaCotizacion,
  type ModalidadEntrega,
} from "@/lib/cotizaciones";
import { MODALIDADES_ENTREGA } from "@/lib/cotizaciones-comun";
import { esDeLaSesion, permisosDe } from "@/lib/permisos";
import { getSession } from "@/lib/session";
import { AccionesDocumento } from "./acciones-documento";
import { estilos } from "./estilos";

// El documento sale con lo que hay ahora, no con lo que había en el caché.
export const dynamic = "force-dynamic";

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

export default async function DocumentoCotizacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  if (!RECORD_ID.test(id)) {
    notFound();
  }

  const cotizacion = await obtenerCotizacion(id);
  if (!cotizacion) {
    notFound();
  }

  const permisos = permisosDe(session);
  const autor = {
    idPersonalCore: cotizacion.idPersonalCore,
    responsable: cotizacion.responsable,
  };

  // Sin alcance de equipo solo se imprime lo propio. No se explica el motivo
  // en una hoja que va al cliente: se responde 404, como a un id que no existe.
  if (!permisos.verTodo && !esDeLaSesion(autor, session)) {
    notFound();
  }

  // El pie lleva a quién responderle. Sale de Nómina, no se transcribe.
  const personal = await listarPersonalActivo();
  const emisor = personal.find(
    (p) => p.idEmpleado === cotizacion.idPersonalCore,
  );

  const rotulo = `${cotizacion.id} · ${formatearRevision(cotizacion.revision)}`;

  return (
    <div className="doc-cotizacion">
      <style>{estilos}</style>

      <div className="acciones">
        <Link href="/dashboard/cotizaciones" className="volver">
          ← Volver a cotizaciones
        </Link>
        <AccionesDocumento />
      </div>

      <div className="hoja">
        <div className="top">
          <div className="logo">
            sırıus<span>.</span>
          </div>
          <div className="emisor">
            <strong>{EMISOR.razonSocial}</strong>
            {EMISOR.nit} · {EMISOR.direccion}
            <br />
            {EMISOR.ciudad}
          </div>
        </div>

        <div className="titulo-fila">
          <h1>
            Cotización <b>{cotizacion.titulo ?? "comercial"}</b>
          </h1>
          <div className="folio">
            <div className="et">Oferta comercial</div>
            <div className="num">{rotulo}</div>
          </div>
        </div>

        <div className="meta">
          <div>
            <div className="et">Destinatario</div>
            <div className="val">
              {cotizacion.cliente ?? "—"}
              {cotizacion.nitCliente ? (
                <>
                  <br />
                  <span className="nota">NIT {cotizacion.nitCliente}</span>
                </>
              ) : null}
            </div>
          </div>
          <div>
            <div className="et">Atención</div>
            <div className="val">
              {cotizacion.contacto ?? "—"}
              {cotizacion.cargoContacto ? (
                <>
                  <br />
                  <span className="nota">{cotizacion.cargoContacto}</span>
                </>
              ) : null}
            </div>
          </div>
          <div>
            <div className="et">Fecha de emisión</div>
            <div className="val">
              {formatearFechaLarga(cotizacion.fechaEmision)}
            </div>
          </div>
          <div>
            <div className="et">Vigencia</div>
            <div className="val">
              {formatearVigencia(
                cotizacion.fechaEmision,
                cotizacion.vigenciaDias,
              )}
            </div>
          </div>
        </div>

        {/* 01 */}
        <Seccion numero="01" titulo="El producto" etiqueta="Bioinsumos ofertados">
          {cotizacion.introduccion ? <p>{cotizacion.introduccion}</p> : null}

          {cotizacion.lineas.map((linea) => (
            <div className="campo" key={linea.recordId}>
              <div className="k">{linea.producto ?? linea.idProductoCore}</div>
              <div className="v">{linea.descripcion ?? "—"}</div>
            </div>
          ))}

          <p className="nota separada">
            Fichas técnicas y certificados de análisis del lote se entregan con
            el despacho o bajo solicitud.
          </p>
        </Seccion>

        {/* 02 */}
        <Seccion
          numero="02"
          titulo="Oferta comercial"
          etiqueta="Moneda: COP"
        >
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Valor unit.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {cotizacion.lineas.map((linea) => (
                <Renglon key={linea.recordId} linea={linea} />
              ))}

              <tr className="sub">
                <td colSpan={3}>Subtotal antes de IVA</td>
                <td>{formatearPesos(cotizacion.subtotal)}</td>
              </tr>
              <tr className="sub">
                <td colSpan={3}>
                  IVA
                  {cotizacion.ivaPorcentaje !== null
                    ? ` ${cotizacion.ivaPorcentaje} %`
                    : ""}
                </td>
                <td>
                  {/* Sin IVA definido el documento lo dice, en vez de imprimir
                      un cero que nadie autorizó. */}
                  {cotizacion.iva === null
                    ? "Por confirmar"
                    : formatearPesos(cotizacion.iva)}
                </td>
              </tr>
              <tr className="total">
                <td colSpan={3}>Valor total de la oferta (COP)</td>
                <td>{formatearPesos(cotizacion.total)}</td>
              </tr>
            </tbody>
          </table>

          <div className="aviso">
            El valor no incluye transporte. El flete se detalla en la sección 03
            según el punto de entrega.
          </div>
        </Seccion>

        {/* 03 */}
        <Seccion
          numero="03"
          titulo="Entrega y transporte"
          etiqueta="Producto biológico vivo"
        >
          <p className="nota">
            La fecha de despacho depende del ciclo de producción del laboratorio
            y se confirma por escrito antes de facturar.
          </p>

          {MODALIDADES_ENTREGA.map((modalidad) => (
            <Opcion
              key={modalidad}
              titulo={modalidad}
              nota={NOTA_MODALIDAD[modalidad as ModalidadEntrega]}
              marcada={cotizacion.modalidadEntrega === modalidad}
            />
          ))}

          <div className="rejilla separada">
            <Dato k="Punto de entrega" v={cotizacion.puntoEntrega} />
            <Dato
              k="Valor del flete"
              v={
                cotizacion.valorFlete === null
                  ? "No aplica"
                  : formatearPesos(cotizacion.valorFlete)
              }
            />
            <Dato
              k="Fecha de despacho"
              v={
                cotizacion.fechaDespacho
                  ? formatearFechaLarga(cotizacion.fechaDespacho)
                  : null
              }
            />
            <Dato
              k="Fecha de entrega"
              v={
                cotizacion.fechaEntrega
                  ? formatearFechaLarga(cotizacion.fechaEntrega)
                  : null
              }
            />
            <Dato k="Quien recibe" v={cotizacion.quienRecibe} />
            <Dato k="Horario de recibo" v={cotizacion.horarioRecibo} />
          </div>
        </Seccion>

        {/* 04 */}
        <Seccion
          numero="04"
          titulo="Condiciones comerciales"
          etiqueta="Vigentes durante la oferta"
        >
          <div className="rejilla">
            <Dato k="Forma de pago" v={cotizacion.formaPago} />
            <Dato k="Orden de compra" v={cotizacion.ordenCompra} />
            <Dato k="Facturación" v={cotizacion.emailFacturacion} />
            <Dato k="Registro ICA" v={cotizacion.registroIca} />
          </div>

          {cotizacion.observaciones ? (
            <div className="campo alto">
              <div className="k">Observaciones</div>
              <div className="v">{cotizacion.observaciones}</div>
            </div>
          ) : null}

          <p className="nota separada">
            Los valores se mantienen en firme durante la vigencia de esta
            oferta. Cualquier cambio en cantidades o en el punto de entrega
            obliga a emitir una revisión con el mismo consecutivo.
          </p>
        </Seccion>

        {/* 05 */}
        <Seccion
          numero="05"
          titulo="Presentación y manejo"
          etiqueta="Microorganismos vivos"
        >
          <div className="rejilla">
            <Dato k="Presentación" v={cotizacion.presentacion} />
            <Dato k="Unidades" v={cotizacion.unidades} />
            <Dato k="Almacenamiento" v={cotizacion.almacenamiento} />
            <Dato
              k="Vida útil"
              v={
                cotizacion.vidaUtilDias === null
                  ? null
                  : `${cotizacion.vidaUtilDias} días desde la producción del lote`
              }
            />
          </div>

          <p className="nota separada">
            Al tratarse de microorganismos vivos, la vida útil corre desde la
            fecha de producción del lote. Se recomienda programar la aplicación
            dentro de ese plazo y no almacenar el producto más de lo necesario.
          </p>
        </Seccion>

        <div className="firmas">
          <div className="firma">
            Por {EMISOR.razonSocial}
            <br />
            {cotizacion.responsable ?? "—"}
          </div>
          <div className="firma">
            Aceptación del cliente · {cotizacion.cliente ?? "—"}
            <br />
            Nombre, cargo y fecha
          </div>
        </div>

        <footer>
          <div className="bloque">
            <div className="et">Emisor</div>
            <strong>{EMISOR.razonSocial}</strong>
            {EMISOR.nit}
            <br />
            {EMISOR.direccion}, {EMISOR.ciudad}
          </div>
          <div className="bloque">
            <div className="et">Contacto comercial</div>
            <strong>{cotizacion.responsable ?? "—"}</strong>
            {emisor?.telefono ? (
              <>
                <a href={`tel:${emisor.telefono.replace(/\s+/g, "")}`}>
                  {emisor.telefono}
                </a>
                <br />
              </>
            ) : null}
            {emisor?.email ? (
              <a href={`mailto:${emisor.email}`}>{emisor.email}</a>
            ) : null}
          </div>
        </footer>

        <p className="legal">{textoLegal(cotizacion.id)}</p>
      </div>
    </div>
  );
}

function Seccion({
  numero,
  titulo,
  etiqueta,
  children,
}: {
  numero: string;
  titulo: string;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="cab">
        <div className="n">{numero}</div>
        <h2>{titulo}</h2>
        <div className="et">{etiqueta}</div>
      </div>
      <div className="cuerpo">{children}</div>
    </section>
  );
}

function Renglon({ linea }: { linea: LineaCotizacion }) {
  const ficha = [linea.idProductoCore, linea.fichaTecnica]
    .filter(Boolean)
    .join(" · ");

  return (
    <tr>
      <td className="desc">
        {linea.producto ?? linea.idProductoCore}
        {ficha ? <small>{ficha}</small> : null}
      </td>
      <td>
        {formatearCantidad(linea.cantidad)}
        {linea.unidad ? ` ${linea.unidad}` : ""}
      </td>
      <td>{formatearPesos(linea.precioUnitario)}</td>
      <td>{formatearPesos(linea.subtotal)}</td>
    </tr>
  );
}

/**
 * Un dato acordado. Lo que quedó sin definir se imprime como "Por confirmar":
 * un renglón en blanco se lee como un olvido, y esto dice que sigue abierto.
 */
function Dato({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="campo">
      <div className="k">{k}</div>
      <div className={v ? "v" : "v pendiente"}>{v ?? "Por confirmar"}</div>
    </div>
  );
}

/** Las tres modalidades, con la acordada marcada. */
function Opcion({
  titulo,
  nota,
  marcada,
}: {
  titulo: string;
  nota: string;
  marcada: boolean;
}) {
  return (
    <div className={marcada ? "opcion marcada" : "opcion"}>
      <span className="marca" aria-hidden="true">
        {marcada ? "×" : ""}
      </span>
      <span>
        <b>{titulo}</b>
        <em>{nota}</em>
      </span>
    </div>
  );
}
