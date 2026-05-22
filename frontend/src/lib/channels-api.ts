import { createClient } from '@/utils/supabase/client';
import type { VoiceEvent } from '@/lib/groups-api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

export const CHANNEL_EVENTS_KEY = (channelId: string) => ['channel-events', channelId] as const;

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
    throw new Error((body as { message?: string; error?: string }).message ?? (body as { error?: string }).error ?? `Request failed (${res.status})`);
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
  membership_status?: 'member' | 'requested' | 'none';
  member_count?: number;
}

export interface ChannelMember {
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joined_at?: string;
  user: {
    id: string;
    username: string | null;
    avatar_url: string | null;
    banner?: string | null;
    bio?: string | null;
    is_verified?: boolean | null;
    sub_plan?: 'FREE' | 'PRO' | 'GEEK' | null;
  };
}

export interface ChannelJoinRequest {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
  user: { id: string; username: string | null; avatar_url: string | null };
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

  getMembers: (id: string) => authedFetch<ChannelMember[]>(`/channels/${id}/members`),

  addMember: (id: string, userId: string, role: 'ADMIN' | 'MEMBER' = 'MEMBER') =>
    authedFetch(`/channels/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    }),

  kickMember: (channelId: string, userId: string) =>
    authedFetch(`/channels/${channelId}/members/${userId}`, { method: 'DELETE' }),

  getJoinRequests: (channelId: string) =>
    authedFetch<ChannelJoinRequest[]>(`/channels/${channelId}/join-requests`),

  respondToJoinRequest: (channelId: string, requestId: string, status: 'ACCEPTED' | 'REJECTED') =>
    authedFetch(`/channels/${channelId}/join-requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  joinChannel: (id: string) =>
    authedFetch(`/channels/${id}/join`, { method: 'POST' }),

  discoverChannels: () => authedFetch<Channel[]>('/channels/discover'),

  requestJoinChannel: (id: string) =>
    authedFetch(`/channels/${id}/request-join`, { method: 'POST' }),

  getChannelEvents: (channelId: string) =>
    authedFetch<VoiceEvent[]>(`/channels/${channelId}/events`),

  createChannelEvent: (
    channelId: string,
    data: {
      group_id: string;
      title: string;
      description?: string;
      scheduled_start: string;
      scheduled_end?: string | null;
    },
  ) =>
    authedFetch<VoiceEvent>(`/channels/${channelId}/events`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
