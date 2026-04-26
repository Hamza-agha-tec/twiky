'use client'

import {
  FeedMemberProfileView,
  buildStandaloneFeedMemberProfile,
  type FeedPost,
  type FeedSubPlan,
} from '@/components/chat/channel-feed'
interface DirectProfileSidebarProps {
  activeChat: string
  userId?: string
  chatOverride?: {
    avatarUrl?: string | null
    isOnline?: boolean
    subPlan?: FeedSubPlan | null
    isVerified?: boolean
    name: string
    subtitle?: string | null
  }
  onClose: () => void
}

export function DirectProfileSidebar({ activeChat, userId, chatOverride, onClose }: DirectProfileSidebarProps) {
  const name = chatOverride?.name ?? 'Direct chat'
  const avatar = chatOverride?.avatarUrl ?? null
  const memberProfile = buildStandaloneFeedMemberProfile({
    id: userId,
    avatarUrl: avatar,
    handle: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    role: 'Member',
    status: chatOverride?.subtitle ?? (chatOverride?.isOnline ? 'Online now' : 'Direct chat'),
    subPlan: chatOverride?.subPlan ?? null,
    isVerified: chatOverride?.isVerified ?? false,
  })

  return (
    <FeedMemberProfileView
      currentGroupLabel="Direct chat"
      isOwn={false}
      memberProfile={memberProfile}
      messagePending={false}
      onBack={onClose}
      onMessage={() => {}}
      posts={[]}
      showMessageAction={false}
      hideRole
    />
  )
}
