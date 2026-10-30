/**
 * Variáveis de ambiente do frontend.
 * Defaults para desenvolvimento local.
 */
export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

export function getWsUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WS_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3001'
  );
}

/** Quando false (padrão), o passageiro só acompanha a van; UI de check-in fica oculta (API permanece disponível). */
export function isPassengerCheckinEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PASSENGER_CHECKIN_ENABLED === 'true';
}
