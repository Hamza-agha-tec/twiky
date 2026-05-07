'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3500'

async function fetchLiveKitToken(roomName: string, participantIdentity: string): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token ?? ''

  const res = await fetch(`${API_URL}/livekit/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roomName, participantIdentity }),
  })

  if (!res.ok) throw new Error(`Failed to get LiveKit token (${res.status})`)
  const json = await res.json()
  return json.token as string
}

type TokenState = {
  token: string | null
  loading: boolean
  error: string | null
}

export function useLiveKitToken(roomName: string | null, participantIdentity: string | null) {
  const [state, setState] = useState<TokenState>({ token: null, loading: false, error: null })

  useEffect(() => {
    if (!roomName || !participantIdentity) return
    let cancelled = false

    setState({ token: null, loading: true, error: null })

    fetchLiveKitToken(roomName, participantIdentity)
      .then((token) => {
        if (!cancelled) setState({ token, loading: false, error: null })
      })
      .catch((err) => {
        if (!cancelled) setState({ token: null, loading: false, error: err.message })
      })

    return () => { cancelled = true }
  }, [roomName, participantIdentity])

  return state
}

export { fetchLiveKitToken }
