/**
 * Decodifica o payload do JWT (base64) e retorna o timestamp de expiração em ms.
 * Retorna null se token inválido ou sem exp.
 */
export function getJwtExpMs(token: string): number | null {
  if (!token?.trim()) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1])) as { exp?: number };
    if (typeof payload.exp !== 'number') return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}
