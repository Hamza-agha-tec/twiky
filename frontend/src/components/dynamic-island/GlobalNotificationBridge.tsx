'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getSocket } from '@/lib/socket'
import { useDynamicIsland } from '@/context/DynamicIslandContext'
import type { BackendDirectMessage } from '@/lib/direct-conversations-api'
import type { Notification } from '@/lib/notifications-api'

const NOTIFICATION_LABELS: Record<string, string> = {
  LIKE: 'liked your post',
  COMMENT: 'commented on your post',
  FOLLOW: 'started following you',
  MENTION: 'mentioned you',
  INVITATION: 'invited you to a channel',
  REPLY: 'replied to you',
}

export function GlobalNotificationBridge() {
  const { user } = useAuth()
  const { push } = useDynamicIsland()
  const pathname = usePathname()
  const activeDmRef = useRef<string | null>(null)
  const handledRef = useRef<Set<string>>(new Set())

  // Track active DM from pathname (not possible via URL alone, so we use a module-level ref)
  // Chat page calls window.__activeDmConversationId = id when switching DMs
  useEffect(() => {
    const sync = () => {
      activeDmRef.current = (window as any).__activeDmConversationId ?? null
    }
    window.addEventListener('activeDmChanged', sync)
    return () => window.removeEventListener('activeDmChanged', sync)
  }, [])

  useEffect(() => {
    if (!user?.id) return

    let mounted = true
    let cleanup: (() => void) | null = null

    getSocket().then((socket) => {
      if (!mounted) return

      const onDm = (raw: BackendDirectMessage) => {
        if (!mounted) return
        if (raw.sender_id === user.id) return
        if (handledRef.current.has(raw.id)) return
        handledRef.current.add(raw.id)

        const isViewingThisConv = activeDmRef.current === raw.conversation_id
        if (isViewingThisConv) return

        const senderName = raw.sender?.username ?? 'Someone'
        const body =
          raw.type === 'image' ? '📷 Image'
          : raw.type === 'voice' ? '🎤 Voice message'
          : raw.type === 'file' ? '📎 File'
          : raw.content ?? '…'

        push({
          type: 'dm',
          avatar: raw.sender?.avatar_url ?? null,
          title: senderName,
          body,
          href: '/chat',
          conversationId: raw.conversation_id,
        })
      }

      const onNotification = (n: Notification) => {
        if (!mounted) return
        if (handledRef.current.has(n.id)) return
        handledRef.current.add(n.id)

        // Already on notifications page — skip
        if (pathname?.startsWith('/notifications')) return

        const actorName = n.actor?.username ?? 'Someone'
        const label = NOTIFICATION_LABELS[n.type] ?? 'sent you a notification'

        push({
          type: n.type === 'MENTION' ? 'mention' : n.type === 'INVITATION' ? 'invite' : 'general',
          avatar: n.actor?.avatar_url ?? null,
          title: actorName,
          body: label,
          href: '/notifications',
        })
      }

      socket.on('newDirectMessage', onDm)
      socket.on('newDirectMessageNotification', onDm)
      socket.on('newNotification', onNotification)

      cleanup = () => {
        socket.off('newDirectMessage', onDm)
        socket.off('newDirectMessageNotification', onDm)
        socket.off('newNotification', onNotification)
      }
    })

    return () => {
      mounted = false
      cleanup?.()
    }
  }, [user?.id, push, pathname])

  return null
}
