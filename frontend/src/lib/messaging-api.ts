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
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export const messagingApi = {
  // Conversations
  getConversations: () => authedFetch('/messaging/conversations'),

  createConversation: (data: { participantIds: string[]; isGroup?: boolean; name?: string }) =>
    authedFetch('/messaging/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Messages
  getMessages: (conversationId: string, limit = 50, offset = 0) =>
    authedFetch(`/messaging/messages/${conversationId}?limit=${limit}&offset=${offset}`),

  editMessage: (id: string, content: string) =>
    authedFetch(`/messaging/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }),

  deleteMessage: (id: string) =>
    authedFetch(`/messaging/messages/${id}`, { method: 'DELETE' }),

  reactToMessage: (id: string, emoji: string) =>
    authedFetch(`/messaging/messages/${id}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    }),

  // File upload (multipart)
  uploadFile: async (file: File): Promise<{ fileName: string; fileUrl: string; fileType: string }> => {
    const token = await getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/messaging/messages/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? 'Upload failed');
    }
    return res.json();
  },
};
