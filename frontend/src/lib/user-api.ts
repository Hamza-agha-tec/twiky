import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export const userApi = {
  getProfile: () => authedFetch('/users/profile'),
  updateProfile: (data: { username?: string; phone_number?: string }) =>
    authedFetch('/users/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  getSettings: () => authedFetch('/users/settings'),
  updateSettings: (data: { theme?: string; notifications_enabled?: boolean }) =>
    authedFetch('/users/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  addContact: (data: { nickname: string; phoneNumber: string }) =>
    authedFetch('/contacts', { method: 'POST', body: JSON.stringify(data) }),
};
