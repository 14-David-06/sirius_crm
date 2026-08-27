export const CEDULA_REGEX = /^\d{5,15}$/;

export function normalizeCedula(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cedula = value.replace(/\D/g, "");
  return CEDULA_REGEX.test(cedula) ? cedula : null;
}

/** Reglas mínimas para una contraseña nueva. */
export function validatePassword(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (value.length > 72) {
    return "La contraseña no puede superar los 72 caracteres.";
  }
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    return "La contraseña debe incluir al menos una letra y un número.";
  }
  return null;
}

/**
 * Solo el primer nombre.
 *
 * `/api/auth/lookup` responde antes de que nadie se autentique, así que no
 * debe entregar el nombre legal completo de una persona a quien apenas acertó
 * una cédula. Con el primer nombre alcanza para confirmar que se escribió bien
 * ("Hola, Ana"), que es lo único que la pantalla muestra.
 */
export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? "";
}
