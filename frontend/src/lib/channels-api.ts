import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function authedFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
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

export type ChannelAccess = 'PUBLIC' | 'PRIVATE';

export interface Channel {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  banner_url?: string;
  access_type: ChannelAccess;
  owner_id: string;
  created_at: string;
}

export const channelsApi = {
  createChannel: (data: { name: string; description?: string; avatar_url?: string; banner_url?: string; access_type?: ChannelAccess }) =>
    authedFetch('/channels', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getUserChannels: () => authedFetch('/channels'),

  getChannelDetails: (id: string) => authedFetch(`/channels/${id}`),

  updateChannel: (id: string, data: Partial<Omit<Channel, 'id' | 'owner_id' | 'created_at'>>) =>
    authedFetch(`/channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteChannel: (id: string) =>
    authedFetch(`/channels/${id}`, { method: 'DELETE' }),

  getMembers: (id: string) => authedFetch(`/channels/${id}/members`),

  addMember: (id: string, userId: string, role: 'ADMIN' | 'MEMBER' = 'MEMBER') =>
    authedFetch(`/channels/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    }),

  kickMember: (channelId: string, userId: string) =>
    authedFetch(`/channels/${channelId}/members/${userId}`, { method: 'DELETE' }),

  joinChannel: (id: string) =>
    authedFetch(`/channels/${id}/join`, { method: 'POST' }),

  discoverChannels: () => authedFetch<Channel[]>('/channels/discover'),
};
