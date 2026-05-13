import { createClient } from '@/utils/supabase/client'
import { toChatMessage, type BackendDirectMessage } from '@/lib/direct-conversations-api'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'

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

export const directMessagesApi = {
  toggleDirectMessageReaction: (messageId: string, emoji: string) =>
    authedFetch<BackendDirectMessage>(`/direct-conversations/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }).then(toChatMessage),
}

