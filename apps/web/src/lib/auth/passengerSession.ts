import { clearAuth, setAuth, type AuthData } from './storage';
import { disconnectSocket } from '@/lib/socket';
import { getApiUrl } from '@/lib/env';

const GUEST_STORAGE_KEY = 'dreamdriver_passenger_guest_id';

export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(GUEST_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_STORAGE_KEY, id);
  }
  return id;
}

export function clearGuestId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GUEST_STORAGE_KEY);
}

export async function ensurePassengerSession(): Promise<AuthData> {
  const guestId = getOrCreateGuestId();
  const res = await fetch(`${getApiUrl()}/auth/passenger-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestId }),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed?.message) msg = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg || 'Falha ao iniciar sessão de passageiro');
  }

  const data = (await res.json()) as AuthData;
  setAuth(data);
  return data;
}

/**
 * Nova identidade de convidado: desconecta socket, limpa auth e guestId e recarrega a página.
 */
export function resetPassengerSession(): void {
  disconnectSocket();
  clearAuth();
  clearGuestId();
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
