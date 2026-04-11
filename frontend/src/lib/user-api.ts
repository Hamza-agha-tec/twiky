import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

function humanizeError(status: number, message?: string): string {
  if (message?.toLowerCase().includes('not found') || status === 404)
    return "We couldn't find anyone with that phone number.";
  if (status === 401 || status === 403)
    return 'You need to be logged in to do that.';
  if (status === 409)
    return 'This contact already exists.';
  if (status >= 500)
    return 'Something went wrong on our end. Please try again.';
  return message ?? 'Something went wrong. Please try again.';
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
    throw new Error(humanizeError(res.status, body.message));
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
  getContacts: () => authedFetch('/contacts'),
  addContact: (data: { nickname: string; phoneNumber: string }) =>
    authedFetch('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  updateContact: ({ id, ...data }: { id: string; nickname?: string }) =>
    authedFetch(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteContact: (id: string) =>
    authedFetch(`/contacts/${id}`, { method: 'DELETE' }),
};
