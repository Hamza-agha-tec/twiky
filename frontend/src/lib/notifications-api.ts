import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3500';

export interface NotificationActor {
  id: string;
  username: string;
  avatar_url: string | null;
}

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: string;
  entity_id: string;
  entity_type: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: NotificationActor;
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

interface NotificationsResponse {
  notifications: Notification[]
  limit: number
  offset: number
}

export const notificationsApi = {
  getAll: () => authedFetch<NotificationsResponse>('/notifications').then((r) => r.notifications),
  markAsRead: (id: string) => authedFetch(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllAsRead: () => authedFetch('/notifications/read-all', { method: 'PATCH' }),
};
