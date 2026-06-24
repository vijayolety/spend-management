import { api } from './api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  orgId: string;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await api.post<{ accessToken: string; refreshToken: string }>(
    '/auth/login', { email, password },
  );
  localStorage.setItem('spm_access_token', data.accessToken);
  localStorage.setItem('spm_refresh_token', data.refreshToken);
  return api.get<AuthUser>('/users/me');
}

export async function signup(name: string, email: string, password: string, orgName?: string) {
  const data = await api.post<{ accessToken: string; refreshToken: string }>(
    '/auth/signup', { name, email, password, orgName },
  );
  localStorage.setItem('spm_access_token', data.accessToken);
  localStorage.setItem('spm_refresh_token', data.refreshToken);
  return api.get<AuthUser>('/users/me');
}

export async function logout() {
  try { await api.post('/auth/logout'); } catch {}
  localStorage.removeItem('spm_access_token');
  localStorage.removeItem('spm_refresh_token');
  window.location.href = '/login';
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('spm_user');
  return raw ? JSON.parse(raw) : null;
}

export function storeUser(user: AuthUser) {
  localStorage.setItem('spm_user', JSON.stringify(user));
}
