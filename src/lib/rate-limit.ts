/**
 * Límite de intentos en memoria. Suficiente para una instancia;
 * si el CRM se despliega en varias, mover esto a Redis o similar.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export function resetAttempts(key: string): void {
  attempts.delete(key);
}
