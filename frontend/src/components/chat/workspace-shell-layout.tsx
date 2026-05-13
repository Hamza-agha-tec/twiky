'use client'

import { useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { IconRail, type ActiveView } from '@/components/chat/icon-rail'
import { useNotifications } from '@/hooks/use-notifications'
import { useProfile } from '@/hooks/use-user'

const PATH_BY_VIEW: Record<Exclude<ActiveView, 'settings'>, string> = {
  chat: '/chat',
  'discover-channels': '/discover-channels',
  'add-friends': '/add-friends',
  notifications: '/notifications',
  store: '/store',
  game: '/game',
}

function getActiveView(pathname: string): ActiveView {
  if (pathname.startsWith('/discover-channels') || pathname.startsWith('/chat/discover-channels')) return 'discover-channels'
  if (pathname.startsWith('/add-friends') || pathname.startsWith('/chat/add-friends')) return 'add-friends'
  if (pathname.startsWith('/notifications') || pathname.startsWith('/chat/notifications')) return 'notifications'
  if (pathname.startsWith('/store') || pathname.startsWith('/chat/store')) return 'store'
  if (pathname.startsWith('/game') || pathname.startsWith('/chat/game')) return 'game'
  if (pathname.startsWith('/settings') || pathname.startsWith('/chat/settings')) return 'settings'
  return 'chat'
}

export function WorkspaceShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: profile } = useProfile()
  const { data: notificationsData } = useNotifications()
  const notifications = notificationsData ?? []

  const activeView = useMemo(() => getActiveView(pathname), [pathname])
  const unreadNotificationCount = notifications.filter((n) => !n.is_read && n.type !== 'MENTION').length
  const userInitial = (profile?.username?.[0] ?? 'Y').toUpperCase()
  const userAvatar = profile?.avatar_url ?? undefined

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <IconRail
        activeView={activeView}
        onViewChange={(view) => {
          if (view === 'settings') {
            router.push('/settings/account')
            return
          }
          router.push(PATH_BY_VIEW[view])
        }}
        onAvatarClick={() => router.push('/settings/profile')}
        userInitial={userInitial}
        userAvatar={userAvatar}
        notificationCount={unreadNotificationCount}
      />
      {children}
    </div>
  )
}
