'use client'

import { createClient } from '@/utils/supabase/client'
import type { ChatMessage } from '@/hooks/use-messaging'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'

async function getToken(): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function authedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export type DirectConversation = {
  id: string
  user_one_id: string
  user_two_id: string
  created_at: string
  user_one?: { id: string; username: string | null; avatar_url: string | null; banner?: string | null; sub_plan?: string | null; is_verified?: boolean | null; last_seen_at?: string | null; last_seen_hidden?: boolean | null; who_can_see_my_last_seen?: string | null } | null
  user_two?: { id: string; username: string | null; avatar_url: string | null; banner?: string | null; sub_plan?: string | null; is_verified?: boolean | null; last_seen_at?: string | null; last_seen_hidden?: boolean | null; who_can_see_my_last_seen?: string | null } | null
  last_message?: Array<{ id: string; content: string | null; type?: string | null; file_url?: string | null; sender_id: string; created_at: string }> | null
  unread_count?: number
}

export type BackendDirectMessage = {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  type?: 'text' | 'image' | 'file' | 'voice' | 'call' | string | null
  file_url: string | null
  mime?: string | null
  duration?: number | null
  size?: number | null
  file_urls?: string[] | null
  created_at: string
  status?: 'sent' | 'delivered' | 'read' | string | null
  reactions?: unknown
  is_pinned?: boolean | null
  is_forwarded?: boolean | null
  reply_to?: { id: string; content: string | null; sender: { id: string; username: string } } | null
  sender: {
    id: string
    username: string
    fullname?: string | null
    full_name?: string | null
    avatar_url: string | null
    is_verified?: boolean | null
    sub_plan?: 'FREE' | 'PRO' | 'GEEK' | null
  }
}

export function toChatMessage(m: BackendDirectMessage): ChatMessage {
  const reactions =
    Array.isArray(m.reactions)
      ? (m.reactions as any[])
          .flatMap((r) => {
            if (!r || typeof r.emoji !== 'string') return []
            const users = Array.isArray(r.users) ? r.users : []
            return users
              .filter((id: unknown): id is string => typeof id === 'string')
              .map((userId: string) => ({ userId, emoji: r.emoji }))
          })
      : []

  return {
    id: m.id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    content: m.content,
    type: (m.type as any) ?? (m.file_url ? 'file' : 'text'),
    file_url: m.file_url,
    metadata: {
      mime: m.mime ?? undefined,
      duration: m.duration ?? undefined,
      size: m.size ?? undefined,
    },
    status: (m.status as any) ?? 'sent',
    reactions,
    is_pinned: m.is_pinned ?? false,
    is_forwarded: m.is_forwarded ?? false,
    reply_to: m.reply_to
      ? { id: m.reply_to.id, content: m.reply_to.content ?? null, sender: m.reply_to.sender }
      : null,
    created_at: m.created_at,
    sender: m.sender,
  }
}

export const directConversationsApi = {
  list: () => authedFetch<DirectConversation[]>('/direct-conversations'),
  create: (targetUserId: string) =>
    authedFetch<DirectConversation>('/direct-conversations', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),
  messages: (conversationId: string) =>
    authedFetch<BackendDirectMessage[]>(`/direct-conversations/${conversationId}/messages`).then((items) =>
      (items ?? []).map(toChatMessage),
    ),
  sendMessage: (
    conversationId: string,
    body: {
      content?: string
      type?: string
      fileUrl?: string | null
      replyToId?: string | null
      fileUrls?: string[]
      entityMentions?: any[]
      mime?: string
      duration?: number
      size?: number
      isForwarded?: boolean
    },
  ) =>
    authedFetch<BackendDirectMessage>(`/direct-conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }).then(toChatMessage),
  deleteConversation: (conversationId: string) =>
    authedFetch<{ success: boolean }>(`/direct-conversations/${conversationId}`, { method: 'DELETE' }),
}

