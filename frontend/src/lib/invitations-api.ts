import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3500';

export interface InvitationInviter {
  id: string;
  username: string;
  avatar_url: string | null;
}

export interface Invitation {
  id: string;
  inviter_id: string;
  invitee_id: string;
  entity_type: 'CHANNEL' | 'GROUP' | 'FOLLOW';
  entity_id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
  updated_at: string;
  inviter: InvitationInviter;
}

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
    throw new Error(body.message ?? 'Request failed');
  }
  return res.json();
}

export const invitationsApi = {
  getPending: () => authedFetch<Invitation[]>('/invitations'),

  send: (inviteeId: string, entityType: 'CHANNEL' | 'GROUP' | 'FOLLOW', entityId: string) =>
    authedFetch<Invitation>('/invitations', {
      method: 'POST',
      body: JSON.stringify({ inviteeId, entityType, entityId }),
    }),

  respond: (invitationId: string, status: 'ACCEPTED' | 'REJECTED') =>
    authedFetch('/invitations/respond', {
      method: 'POST',
      body: JSON.stringify({ invitationId, status }),
    }),
};
