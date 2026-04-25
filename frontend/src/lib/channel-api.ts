import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3500';

export interface BackendChannel {
  id: string;
  name: string;
  owner_id: string;
  avatar_url: string | null;
  banner_url: string | null;
  created_at: string;
  description: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | string;
  access_type?: 'PUBLIC' | 'PRIVATE';
  type?: 'NORMAL' | 'WORKSPACE';
  invite_code?: string;
}

export interface CreateChannelInput {
  name: string;
  description?: string;
  avatar_url?: string;
  access_type?: 'PUBLIC' | 'PRIVATE';
  type?: 'NORMAL' | 'WORKSPACE';
}

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function authedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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

export interface ChannelInviteLink {
  channel_id: string;
  channel_name: string;
  invite_code: string;
  path: string;
}

export const channelApi = {
  getChannels: () => authedFetch<BackendChannel[]>('/channels'),
  createChannel: (data: CreateChannelInput) =>
    authedFetch<BackendChannel>('/channels', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getInviteLink: (channelId: string) =>
    authedFetch<ChannelInviteLink>(`/channels/${channelId}/invite-link`),
};
