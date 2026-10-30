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

export function getAuth(): AuthData | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as AuthData;
  } catch {
    return null;
  }
}

export function setAuth(data: AuthData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
