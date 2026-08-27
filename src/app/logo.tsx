import Image from "next/image";

import logoTinta from "../../public/logo-marca-tinta.png";
import logoClaro from "../../public/logo-marca-blanco.png";

/** El logotipo original mide 941 × 376; de ahí sale el ancho para cada alto. */
const PROPORCION = 941 / 376;

/**
 * Logotipo de Sirius.
 *
 * El azul de la marca (#004E9D) casi desaparece sobre fondos oscuros, así que
 * `auto` intercambia la versión de tinta por la blanca según el tema. En las
 * superficies que siempre son oscuras — el landing — se fuerza con `claro`.
 */
export function LogoSirius({
  alto = 32,
  variante = "auto",
}: {
  alto?: number;
  variante?: "auto" | "claro";
}) {
  const ancho = Math.round(alto * PROPORCION);

  if (variante === "claro") {
    return (
      <Image src={logoClaro} alt="Sirius" width={ancho} height={alto} priority />
    );
  }

  return (
    <>
      <Image
        src={logoTinta}
        alt="Sirius"
        width={ancho}
        height={alto}
        priority
        className="dark:hidden"
      />
      <Image
        src={logoClaro}
        alt=""
        aria-hidden="true"
        width={ancho}
        height={alto}
        priority
        className="hidden dark:block"
      />
    </>
  );
}
