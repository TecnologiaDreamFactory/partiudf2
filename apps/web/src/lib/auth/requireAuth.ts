import { getAuth, clearAuth, type AuthUser } from './storage';
import { disconnectSocket } from '@/lib/socket';

export interface RequireAuthResult {
  ok: boolean;
  user: AuthUser | null;
}

/**
 * Verifica se o usuário está autenticado e tem uma das roles permitidas.
 */
export function requireAuth(allowedRoles: string[]): RequireAuthResult {
  const auth = getAuth();
  if (!auth?.token || !auth?.user) {
    return { ok: false, user: null };
  }
  if (!allowedRoles.includes(auth.user.role)) {
    return { ok: false, user: auth.user };
  }
  return { ok: true, user: auth.user };
}

/**
 * Faz logout: encerra trip (driver) ou cancela check-in (passenger), desconecta socket,
 * limpa storage e redireciona para /login.
 */
export async function logout(): Promise<void> {
  const auth = getAuth();
  if (auth?.user) {
    try {
      const { fetchTripStatus, apiFetch } = await import('@/lib/api');
      if (auth.user.role === 'DRIVER') {
        const st = await fetchTripStatus();
        if (st.hasActiveTrip && st.trip?.driverId === auth.user.id) {
          await apiFetch(`/trips/${st.trip.id}/end`, { method: 'POST' });
        }
      } else if (auth.user.role === 'PASSENGER') {
        const st = await fetchTripStatus();
        if (st.hasActiveTrip && st.trip) {
          await apiFetch('/checkins/cancel', {
            method: 'POST',
            body: JSON.stringify({ tripId: st.trip.id }),
          });
        }
      }
    } catch {
      /* ignora erros - prossegue com logout */
    }
  }
  disconnectSocket();
  clearAuth();
  if (typeof window !== 'undefined') {
    window.location.replace('/login');
  }
}
