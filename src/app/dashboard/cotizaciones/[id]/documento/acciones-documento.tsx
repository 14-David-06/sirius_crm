"use client";

/**
 * La barra de acciones del documento. Es lo único interactivo de la hoja, y no
 * se imprime: `window.print()` necesita ejecutarse en el navegador.
 */
export function AccionesDocumento() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="cursor-pointer rounded border border-[#1665C0] bg-[#1665C0] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-200 hover:border-[#0F4C93] hover:bg-[#0F4C93]"
    >
      Guardar como PDF
    </button>
  );
}
