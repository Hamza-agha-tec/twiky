import { createClient } from '../utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

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

export interface VoiceRoom {
  id: string;
  name: string;
  description: string | null;
  channel_id: string;
  access_type: 'PUBLIC' | 'PRIVATE';
  created_at: string;
  group_members: VoiceRoomMember[];
}

export interface VoiceRoomMember {
  user_id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joined_at: string;
  users: {
    id: string;
    username: string | null;
    avatar_url: string | null;
    full_name: string | null;
  };
}

export const voiceApi = {
  getUserVoiceRooms: () =>
    authedFetch<VoiceRoom[]>('/voice/rooms'),

  getVoiceRoom: (roomId: string) =>
    authedFetch<VoiceRoom>(`/voice/rooms/${roomId}`),

  createVoiceRoom: (data: {
    channelId: string;
    name: string;
    description?: string;
    access_type?: 'PUBLIC' | 'PRIVATE';
  }) =>
    authedFetch<VoiceRoom>('/voice/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  validateRoomAccess: (roomId: string) =>
    authedFetch<{ hasAccess: boolean }>(`/voice/rooms/${roomId}/validate-access`, {
      method: 'POST',
    }),
};
