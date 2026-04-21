'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { spotifyApi } from '@/lib/spotify-api'

export default function SpotifyCallbackPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error || !code) {
      router.replace('/chat?spotify=error')
      return
    }

    spotifyApi.connect(code)
      .then(() => router.replace('/chat?spotify=connected'))
      .catch(() => router.replace('/chat?spotify=error'))
  }, [searchParams, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-[13px] text-muted-foreground">Connecting Spotify…</p>
      </div>
    </div>
  )
}
