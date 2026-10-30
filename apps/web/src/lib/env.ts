/**
 * Variaveis de ambiente do frontend.
 */

/** API no mesmo dominio (rotas em src/app/api). NEXT_PUBLIC_API_URL so para apontar para outro host. */
export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? '/api';
}

/** Supabase Realtime (somente leitura no cliente). null = tempo real desligado. */
export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

/** Quando false (padrão), o passageiro só acompanha a van; UI de check-in fica oculta (API permanece disponível). */
export function isPassengerCheckinEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PASSENGER_CHECKIN_ENABLED === 'true';
}
