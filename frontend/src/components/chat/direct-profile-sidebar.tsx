'use client'

import {
  FeedMemberProfileView,
  buildStandaloneFeedMemberProfile,
  type FeedPost,
} from '@/components/chat/channel-feed'
interface DirectProfileSidebarProps {
  activeChat: string
  chatOverride?: {
    avatarUrl?: string | null
    isOnline?: boolean
    isVerified?: boolean
    name: string
    subtitle?: string | null
  }
  onClose: () => void
}

export function DirectProfileSidebar({ activeChat, chatOverride, onClose }: DirectProfileSidebarProps) {
  const name = chatOverride?.name ?? 'Direct chat'
  const avatar = chatOverride?.avatarUrl ?? null
  const memberProfile = buildStandaloneFeedMemberProfile({
    avatarUrl: avatar,
    handle: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    role: 'Member',
    status: chatOverride?.subtitle ?? (chatOverride?.isOnline ? 'Online now' : 'Direct chat'),
    isVerified: chatOverride?.isVerified ?? false,
  })
  const directPosts: FeedPost[] = [
    {
      author: name,
      body: chatOverride?.subtitle ?? 'Direct chat active.',
      id: `${activeChat}-profile`,
      reactions: [],
      replyCount: 0,
      role: 'Member',
      time: 'Now',
    },
  ]

  return (
    <FeedMemberProfileView
      currentGroupLabel="Direct chat"
      isOwn={false}
      memberProfile={memberProfile}
      messagePending={false}
      onBack={onClose}
      onMessage={() => {}}
      posts={directPosts}
      showMessageAction={false}
    />
  )
}
