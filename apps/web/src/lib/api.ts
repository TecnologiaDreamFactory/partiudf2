import { getToken, logout } from '@/lib/auth';
import { getApiUrl } from '@/lib/env';

export async function apiFetch<T>(
  path: string,
  options: Record<string, unknown> & { headers?: Record<string, string> } = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    if (token) {
      logout();
    }
    const text = await res.text();
    throw new Error(text || 'Credenciais inválidas');
  }

  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed?.message) msg = parsed.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg || `Erro na requisição (${res.status})`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return res.text() as Promise<T>;
}

export interface TripStatusResponse {
  hasActiveTrip: boolean;
  trip: {
    id: string;
    startedAt: string;
    driverId: string;
    status: string;
  } | null;
}

/** GET /trips/status */
export async function fetchTripStatus(): Promise<TripStatusResponse> {
  return apiFetch<TripStatusResponse>('/trips/status');
}

export interface TripSnapshotResponse {
  trip: {
    id: string;
    status: string;
    startedAt: string;
    driverId: string;
  };
  checkins: Array<{
    id: string;
    tripId: string;
    user: { id: string; name: string; avatarUrl: string | null };
    pickupPoint: { code: string; name: string; lat: number; lng: number };
    status: string;
    createdAt: string;
  }>;
  lastLocation: {
    lat: number;
    lng: number;
    ts: number;
    accuracy?: number;
    speed?: number | null;
    heading?: number | null;
  } | null;
}

/** GET /trips/:tripId/snapshot */
export async function fetchTripSnapshot(tripId: string): Promise<TripSnapshotResponse> {
  return apiFetch<TripSnapshotResponse>(`/trips/${tripId}/snapshot`);
}

export interface AuthMeResponse {
  id: string;
  email: string;
  role: string;
  name?: string | null;
  avatarUrl?: string | null;
}

/** GET /auth/me */
export async function fetchAuthMe(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>('/auth/me');
}

/** PATCH /auth/me */
export async function updateAuthMe(data: { avatarUrl?: string; name?: string }): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** POST /auth/login */
export async function login(body: { email: string; password: string }): Promise<{
  token: string;
  user: AuthMeResponse;
}> {
  return apiFetch<{ token: string; user: AuthMeResponse }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** PATCH /auth/password */
export async function updatePassword(body: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** PATCH /users/me */
export async function updateUsersMe(data: { avatarUrl?: string; name?: string }): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

/** GET /admin/users */
export async function fetchAdminUsers(role?: string): Promise<AdminUser[]> {
  const qs = role ? `?role=${encodeURIComponent(role)}` : '';
  return apiFetch<AdminUser[]>(`/admin/users${qs}`);
}

/** POST /admin/users */
export async function createAdminUser(body: {
  email: string;
  role: string;
  name?: string;
  avatarUrl?: string;
  password: string;
}): Promise<AdminUser> {
  return apiFetch<AdminUser>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** PATCH /admin/users/:id */
export async function updateAdminUser(
  id: string,
  body: { role?: string; name?: string; avatarUrl?: string; password?: string },
): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** DELETE /admin/users/:id */
export async function deleteAdminUser(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/admin/users/${id}`, {
    method: 'DELETE',
  });
}

export interface AdminPassengerLogin {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  checkinsCount: number;
}

/** GET /admin/passenger-logins */
export async function fetchAdminPassengerLogins(): Promise<AdminPassengerLogin[]> {
  return apiFetch<AdminPassengerLogin[]>('/admin/passenger-logins');
}

/** DELETE /admin/passenger-logins */
export async function deleteAdminPassengerLogins(): Promise<{ ok: boolean; deleted: number }> {
  return apiFetch<{ ok: boolean; deleted: number }>('/admin/passenger-logins', {
    method: 'DELETE',
  });
}

export interface AdminPickupPoint {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  createdAt: string;
}

/** GET /admin/pickup-points */
export async function fetchAdminPickupPoints(): Promise<AdminPickupPoint[]> {
  return apiFetch<AdminPickupPoint[]>('/admin/pickup-points');
}

/** POST /admin/pickup-points */
export async function createAdminPickupPoint(body: {
  code: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
}): Promise<AdminPickupPoint> {
  return apiFetch<AdminPickupPoint>('/admin/pickup-points', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** PATCH /admin/pickup-points/:id */
export async function updateAdminPickupPoint(
  id: string,
  body: {
    code?: string;
    name?: string;
    lat?: number;
    lng?: number;
    address?: string | null;
  },
): Promise<AdminPickupPoint> {
  return apiFetch<AdminPickupPoint>(`/admin/pickup-points/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** DELETE /admin/pickup-points/:id */
export async function deleteAdminPickupPoint(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/admin/pickup-points/${id}`, {
    method: 'DELETE',
  });
}
