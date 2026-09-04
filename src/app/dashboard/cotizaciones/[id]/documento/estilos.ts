/**
 * La hoja de estilos del documento impreso.
 *
 * Vive como texto y no como clases de Tailwind a propósito: esto no es una
 * pantalla del CRM, es una hoja tamaño carta que sale por impresora, y su
 * medida —816 px, que son 8,5 pulgadas a 96 ppp— tiene que sobrevivir tal cual
 * al PDF. Todo va bajo `.doc-cotizacion` para que estos selectores de elemento
 * no se escapen al resto de la aplicación.
 *
 * El documento es siempre claro, incluso con el sistema en modo oscuro: se
 * imprime en papel blanco y una hoja oscura en pantalla engaña sobre cómo va
 * a salir.
 */
export const estilos = `
.doc-cotizacion{
  --azul:#1665C0;
  --azul-osc:#0F4C93;
  --verde:#7AC143;
  --tinta:#1c1c1c;
  --gris:#6b7280;
  --gris-claro:#9aa1ab;
  --linea:#e3e6ea;
  --linea-fuerte:#c9ced6;
  --relleno:#f1f6fc;

  color-scheme:light;
  background:#eceff3;
  color:var(--tinta);
  font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Inter,Helvetica,Arial,sans-serif;
  font-size:14px;
  line-height:1.5;
  min-height:100%;
  padding-bottom:24px;
}
.doc-cotizacion *{box-sizing:border-box;}

.doc-cotizacion .hoja{
  width:816px;
  max-width:100%;
  margin:24px auto;
  background:#fff;
  padding:56px 64px 40px;
  box-shadow:0 2px 18px rgba(0,0,0,.08);
}

/* ---------------------- barra de acciones (no imprime) ------------------- */
.doc-cotizacion .acciones{
  width:816px;max-width:100%;margin:24px auto -8px;
  display:flex;gap:10px;align-items:center;justify-content:space-between;
}
.doc-cotizacion .volver{
  color:var(--gris);font-size:12.5px;text-decoration:none;
}
.doc-cotizacion .volver:hover{color:var(--azul);text-decoration:underline;}

/* ------------------------------ encabezado ------------------------------- */
.doc-cotizacion .top{display:flex;justify-content:space-between;align-items:flex-start;gap:32px;}
.doc-cotizacion .logo{font-size:38px;font-weight:800;letter-spacing:-1.5px;color:var(--azul);line-height:1;}
.doc-cotizacion .logo span{color:var(--verde);}
.doc-cotizacion .emisor{text-align:right;font-size:12px;color:var(--gris);line-height:1.6;}
.doc-cotizacion .emisor strong{display:block;color:var(--tinta);font-size:13px;font-weight:600;}

.doc-cotizacion .titulo-fila{display:flex;justify-content:space-between;align-items:flex-end;margin:38px 0 26px;gap:24px;}
.doc-cotizacion h1{font-size:31px;font-weight:400;margin:0;letter-spacing:-.4px;line-height:1.2;}
.doc-cotizacion h1 b{font-weight:700;color:var(--tinta);}
.doc-cotizacion .folio{text-align:right;}
.doc-cotizacion .folio .et{font-size:10.5px;letter-spacing:1.4px;color:var(--gris-claro);text-transform:uppercase;}
.doc-cotizacion .folio .num{font-size:13px;color:var(--azul);font-weight:600;white-space:nowrap;}

.doc-cotizacion .meta{
  display:grid;grid-template-columns:repeat(4,1fr);gap:18px;
  border-top:1px solid var(--linea-fuerte);border-bottom:1px solid var(--linea-fuerte);
  padding:14px 0;margin-bottom:38px;
}
.doc-cotizacion .meta .et{font-size:9.5px;letter-spacing:1.3px;color:var(--gris-claro);text-transform:uppercase;margin-bottom:3px;}
.doc-cotizacion .meta .val{font-size:13.5px;}

/* ------------------------------- secciones ------------------------------- */
.doc-cotizacion section{margin-bottom:34px;break-inside:avoid;}
.doc-cotizacion .cab{display:flex;align-items:baseline;gap:22px;border-bottom:1px solid var(--tinta);padding-bottom:6px;margin-bottom:16px;}
.doc-cotizacion .n{font-size:34px;font-weight:300;color:var(--azul);line-height:1;letter-spacing:-1px;min-width:52px;}
.doc-cotizacion .cab h2{font-size:18px;font-weight:600;margin:0;flex:1;}
.doc-cotizacion .cab .et{font-size:9.5px;letter-spacing:1.3px;color:var(--gris-claro);text-transform:uppercase;text-align:right;}
.doc-cotizacion .cuerpo{padding-left:74px;}
.doc-cotizacion p{margin:0 0 10px;}
.doc-cotizacion .nota{font-size:12px;color:var(--gris);line-height:1.55;}
.doc-cotizacion .separada{margin-top:12px;}

/* ----------------------------- tabla de oferta --------------------------- */
.doc-cotizacion table{width:100%;border-collapse:collapse;}
.doc-cotizacion th{
  font-size:9.5px;letter-spacing:1.2px;color:var(--gris-claro);text-transform:uppercase;
  font-weight:600;text-align:right;padding:0 0 7px;border-bottom:1px solid var(--linea);
}
.doc-cotizacion th:first-child{text-align:left;}
.doc-cotizacion td{
  padding:13px 0;border-bottom:1px solid var(--linea);text-align:right;vertical-align:top;
  font-variant-numeric:tabular-nums;
}
.doc-cotizacion td:first-child{text-align:left;}
.doc-cotizacion .desc{font-weight:600;}
.doc-cotizacion .desc small{display:block;font-weight:400;color:var(--gris);font-size:11.5px;margin-top:2px;}
.doc-cotizacion tr.total td{border-bottom:none;padding-top:15px;font-size:16px;font-weight:700;}
.doc-cotizacion tr.total td:first-child{color:var(--azul);}
.doc-cotizacion tr.sub td{padding:9px 0 0;border-bottom:none;font-size:13px;color:var(--gris);}

/* --------------------------- rejillas de datos --------------------------- */
.doc-cotizacion .rejilla{display:grid;grid-template-columns:1fr 1fr;gap:0 40px;}
.doc-cotizacion .campo{display:flex;gap:14px;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--linea);}
.doc-cotizacion .campo.alto{align-items:flex-start;}
.doc-cotizacion .campo .k{color:var(--azul);font-size:12.5px;min-width:132px;flex-shrink:0;}
.doc-cotizacion .campo .v{flex:1;font-size:13px;white-space:pre-line;}
/* Lo que quedó sin acordar se ve como pendiente, no como un dato más. */
.doc-cotizacion .campo .v.pendiente{color:var(--gris-claro);}

/* --------------------------- opción de entrega --------------------------- */
.doc-cotizacion .opcion{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--linea);}
.doc-cotizacion .opcion .marca{
  width:14px;height:14px;margin-top:3px;flex-shrink:0;
  border:1px solid var(--linea-fuerte);border-radius:2px;
  font-size:11px;line-height:12px;text-align:center;color:var(--azul);
}
.doc-cotizacion .opcion b{font-size:13px;font-weight:600;color:var(--gris-claro);}
.doc-cotizacion .opcion em{font-style:normal;color:var(--gris-claro);font-size:12px;display:block;margin-top:1px;}
/* La modalidad acordada es la única en tinta plena: se lee de un vistazo. */
.doc-cotizacion .opcion.marcada .marca{border-color:var(--azul);background:var(--relleno);}
.doc-cotizacion .opcion.marcada b{color:var(--tinta);}
.doc-cotizacion .opcion.marcada em{color:var(--gris);}

.doc-cotizacion .aviso{
  border-left:3px solid var(--azul);background:var(--relleno);
  padding:11px 16px;font-size:12.5px;color:#31404f;margin-top:14px;
}

/* ---------------------------------- pie ---------------------------------- */
.doc-cotizacion footer{
  border-top:1px solid var(--linea-fuerte);padding-top:20px;margin-top:44px;
  display:flex;justify-content:space-between;gap:40px;break-inside:avoid;
}
.doc-cotizacion footer .et{font-size:9.5px;letter-spacing:1.3px;color:var(--gris-claro);text-transform:uppercase;margin-bottom:5px;}
.doc-cotizacion footer .bloque{font-size:12px;color:var(--gris);line-height:1.6;}
.doc-cotizacion footer .bloque strong{color:var(--tinta);font-size:13px;display:block;font-weight:600;}
.doc-cotizacion footer a{color:var(--azul);text-decoration:none;}
.doc-cotizacion .legal{font-size:10.5px;color:var(--gris-claro);line-height:1.5;margin-top:22px;}

.doc-cotizacion .firmas{display:grid;grid-template-columns:1fr 1fr;gap:44px;margin-top:30px;break-inside:avoid;}
.doc-cotizacion .firma{border-top:1px solid var(--tinta);padding-top:7px;font-size:11.5px;color:var(--gris);}

@media print{
  .doc-cotizacion{background:#fff;padding-bottom:0;}
  .doc-cotizacion .acciones{display:none;}
  .doc-cotizacion .hoja{width:auto;margin:0;padding:0;box-shadow:none;}
  .doc-cotizacion .aviso{background:transparent;}
  .doc-cotizacion section{break-inside:avoid;}
}

@page{size:letter;margin:14mm 15mm;}

@media (max-width:860px){
  .doc-cotizacion .hoja{padding:28px 22px;}
  .doc-cotizacion .cuerpo{padding-left:0;}
  .doc-cotizacion .meta,
  .doc-cotizacion .rejilla,
  .doc-cotizacion .firmas{grid-template-columns:1fr;}
  .doc-cotizacion .titulo-fila,
  .doc-cotizacion .top,
  .doc-cotizacion footer{flex-direction:column;align-items:flex-start;}
  .doc-cotizacion .emisor,
  .doc-cotizacion .folio{text-align:left;}
  /* La tabla de la oferta se desplaza sola; el resto de la hoja no. */
  .doc-cotizacion table{display:block;overflow-x:auto;}
}
`;
