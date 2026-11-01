const STORAGE_KEY = 'dreamdriver_auth';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthData {
  token: string;
  user: AuthUser;
}

// O celular do motorista é compartilhado: a sessão dele fica só na aba
// (sessionStorage some ao fechar a aba/navegador) e nunca no localStorage.
const storeFor = (role: string) => (role === 'DRIVER' ? sessionStorage : localStorage);

export function getAuth(): AuthData | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as AuthData;
  } catch {
    return null;
  }
}

export function setAuth(data: AuthData): void {
  if (typeof window === 'undefined') return;
  clearAuth();
  storeFor(data.user.role).setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}
