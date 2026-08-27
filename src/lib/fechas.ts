const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/**
 * Las fechas de Airtable llegan como YYYY-MM-DD; se formatean sin pasar por
 * Date para no correrlas un día según la zona horaria del navegador.
 *
 * Vive en lib y no junto a una vista porque la usan tanto componentes de
 * cliente como páginas de servidor: exportarla desde un archivo "use client"
 * rompe la página que la llama en el servidor.
 */
export function formatearFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return fecha;
  return `${dia} ${MESES[mes - 1]} ${anio}`;
}
