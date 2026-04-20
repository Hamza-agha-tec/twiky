'use client'

import {
  FeedMemberProfileView,
  buildStandaloneFeedMemberProfile,
  type FeedPost,
} from '@/components/chat/channel-feed'
import { getConvDisplayName, getConversationAvatar, useConversations } from '@/hooks/use-messaging'
import { useContacts, useProfile } from '@/hooks/use-user'
import { getMockUserAvatar } from '@/lib/mock-users'

interface DirectProfileSidebarProps {
  activeChat: string
  chatOverride?: {
    avatarUrl?: string | null
    isOnline?: boolean
    name: string
    subtitle?: string | null
  }
  onClose: () => void
}

export function DirectProfileSidebar({ activeChat, chatOverride, onClose }: DirectProfileSidebarProps) {
  const { data: profile } = useProfile()
  const { data: contacts = [] } = useContacts()
  const { data: conversations = [] } = useConversations()

  const conv = conversations.find((conversation) => conversation.id === activeChat)
  const myId = profile?.id ?? ''

  const name = conv
    ? getConvDisplayName(conv, myId, contacts)
    : chatOverride?.name ?? 'Direct conversation'
  const avatar =
    (conv ? getConversationAvatar(conv, myId, contacts) : null) ??
    chatOverride?.avatarUrl ??
    getMockUserAvatar(name)
  const memberProfile = buildStandaloneFeedMemberProfile({
    avatarUrl: avatar,
    handle: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    role: 'Member',
    status: chatOverride?.subtitle ?? (chatOverride?.isOnline ? 'Online now' : 'Direct conversation'),
  })
  const directPosts: FeedPost[] = [
    {
      author: name,
      body: chatOverride?.subtitle ?? 'Direct conversation active.',
      id: `${activeChat}-profile`,
      reactions: [],
      replyCount: 0,
      role: 'Member',
      time: 'Now',
    },
  ]

  return (
    <FeedMemberProfileView
      currentGroupLabel="Direct conversation"
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
