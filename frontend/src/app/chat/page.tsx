'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useChannels } from '@/hooks/use-channels'
import { useDirectConversations } from '@/hooks/use-direct-conversations'

export default function ChatRedirectPage() {
  const router = useRouter()
  const { data: channels = [], isLoading: loadingChannels } = useChannels()
  const { data: directConversations = [], isLoading: loadingDms } = useDirectConversations()

  useEffect(() => {
    if (loadingChannels || loadingDms) return

    if (channels.length > 0) {
      router.replace(`/channels/${channels[0].id}`)
    } else if (directConversations.length > 0) {
      router.replace(`/dm/${directConversations[0].id}`)
    } else {
      // Fallback if no channels or DMs
      router.replace('/discover-channels')
    }
  }, [channels, directConversations, loadingChannels, loadingDms, router])

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Redirecting to your workspace...</p>
      </div>
    </div>
  )
}
