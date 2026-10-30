export { getAuth, setAuth, clearAuth, type AuthUser, type AuthData } from './storage';
export { getJwtExpMs } from './jwt';
export { requireAuth, logout, type RequireAuthResult } from './requireAuth';
export {
  getOrCreateGuestId,
  clearGuestId,
  ensurePassengerSession,
  resetPassengerSession,
} from './passengerSession';

import { getAuth } from './storage';

export function getToken(): string | null {
  const auth = getAuth();
  return auth?.token ?? null;
}

export function getUser(): import('./storage').AuthUser | null {
  const auth = getAuth();
  return auth?.user ?? null;
}
