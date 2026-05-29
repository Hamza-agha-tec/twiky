import { createClient } from '@/utils/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

async function getToken(): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await getToken()
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}

export type RoomPayload<T> = {
  state: T | null
  image: string | null
  updatedAt: string | null
}

export type PublicRoomOwner = {
  id: string
  username: string | null
  fullname: string | null
  avatarUrl: string | null
}

export type PublicRoomPayload<T> = {
  owner: PublicRoomOwner
  state: T | null
  image: string | null
  updatedAt: string | null
  likeCount: number
  visitorCount: number
  visitCount: number
  hasLiked: boolean
  isOwn: boolean
}

export async function fetchMyRoom<T = unknown>(): Promise<RoomPayload<T>> {
  const res = await authedFetch('/rooms/me')
  if (!res.ok) throw new Error(`Failed to load room (${res.status})`)
  return res.json()
}

export async function saveMyRoom<T = unknown>(
  state: T,
  image?: string,
): Promise<RoomPayload<T>> {
  const body: Record<string, unknown> = { state }
  if (image !== undefined) body.image = image
  const res = await authedFetch('/rooms/me', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Failed to save room (${res.status})`)
  return res.json()
}

export async function fetchPublicRoom<T = unknown>(
  username: string,
): Promise<PublicRoomPayload<T>> {
  const res = await authedFetch(`/rooms/user/${encodeURIComponent(username)}`)
  if (res.status === 404) throw new Error('Room not found')
  if (!res.ok) throw new Error(`Failed to load room (${res.status})`)
  return res.json()
}

export async function recordRoomVisit(username: string): Promise<void> {
  await authedFetch(`/rooms/user/${encodeURIComponent(username)}/visit`, {
    method: 'POST',
  })
}

export async function toggleRoomLike(
  username: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const res = await authedFetch(`/rooms/user/${encodeURIComponent(username)}/like`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Failed to toggle like (${res.status})`)
  return res.json()
}
