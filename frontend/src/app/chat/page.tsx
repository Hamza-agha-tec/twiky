'use client'

import { useMemo, useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { UserPlus } from 'lucide-react'

import { AddContactModal } from '@/components/chat/add-contact-modal'
import { AddStoryScreen, StoryDraft, getStoryThemeClass } from '@/components/chat/add-story-modal'
import { ChatWindow } from '@/components/chat/chat-window'
import { InfoPanel } from '@/components/chat/info-panel'
import { Sidebar } from '@/components/chat/sidebar'
import { StoryViewItem, StoryViewerScreen } from '@/components/chat/story-viewer-modal'
import { Button } from '@/components/ui/button'
import { useContacts, useProfile } from '@/hooks/use-user'
import { useMessages } from '@/hooks/use-messaging'
import { useSocket, useGlobalSocket, useOnlineUsers } from '@/hooks/use-socket'

type ChatStory = StoryViewItem & {
  hasStory?: boolean
  hasUnseen?: boolean
}

function getStoryLabel(createdAt: string) {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`

  return `${Math.floor(diffHours / 24)}d`
}

export default function ChatPage() {
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [selectedChats, setSelectedChats] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen] = useState(true)
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [showStoryComposer, setShowStoryComposer] = useState(false)
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null)
  const [myStory, setMyStory] = useState<StoryDraft | null>(null)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const { data: profile } = useProfile()
  const { data: contacts = [] } = useContacts()
  const onlineUsers = useOnlineUsers()

  const handleNewMessage = useCallback((convId: string) => {
    setUnreadCounts((prev) => {
      if (convId === activeChat) return prev;
      return { ...prev, [convId]: (prev[convId] ?? 0) + 1 };
    });
  }, [activeChat]);

  const { data: messages = [] } = useMessages(activeChat)
  const { sendMessage, sendTyping, otherIsTyping, reactToMessage, editMessage, deleteMessage } = useSocket(activeChat)
  useGlobalSocket(handleNewMessage)
  const stories = useMemo<ChatStory[]>(() => {
    const storyTimes = ['12m', '35m', '1h', '2h', '5h', '8h']
    const sampleCaptions = [
      'Coffee run before the next sprint.',
      'Sketching a cleaner flow today.',
      'Back online and catching up.',
      'Tiny update, big mood.',
      'Shipping details all afternoon.',
      'Quiet mode, still here.',
    ]
    const themeIds = ['sky', 'sunset', 'forest', 'midnight'] as const

    const feed: ChatStory[] = [
      {
        id: 'my-story',
        name: 'Your story',
        avatar: profile?.avatar_url,
        label: myStory ? getStoryLabel(myStory.createdAt) : 'Add story',
        isOwn: true,
        hasStory: !!myStory,
        hasUnseen: !!myStory,
        caption: myStory?.caption ?? '',
        themeClassName: getStoryThemeClass(myStory?.themeId ?? 'sky'),
        audienceLabel: myStory?.audience === 'close-friends'
          ? 'Close Friends'
          : myStory?.audience === 'everyone'
            ? 'Everyone'
            : 'Contacts',
      },
    ]

    contacts
      .filter((contact) => !contact.is_archived && !contact.is_blocked)
      .slice(0, 7)
      .forEach((contact, index) => {
        feed.push({
          id: `story-${contact.id}`,
          name: contact.nickname ?? contact.username ?? 'Contact',
          avatar: contact.avatar_url,
          label: onlineUsers.has(contact.id) ? 'Now' : storyTimes[index % storyTimes.length],
          hasStory: true,
          hasUnseen: index < 4,
          caption: sampleCaptions[index % sampleCaptions.length],
          themeClassName: getStoryThemeClass(themeIds[index % themeIds.length]),
          audienceLabel: 'Contacts',
        })
      })

    return feed
  }, [contacts, myStory, onlineUsers, profile?.avatar_url])

  function openStoryComposer() {
    setShowStoryComposer(true)
    setActiveStoryId(null)
    setShowContactInfo(false)
  }

  function openStoryViewer(storyId: string) {
    setActiveStoryId(storyId)
    setShowStoryComposer(false)
    setShowContactInfo(false)
  }

  function closeStorySurface() {
    setActiveStoryId(null)
    setShowStoryComposer(false)
  }

  function handleStorySubmit(story: StoryDraft) {
    setMyStory(story)
    setShowStoryComposer(false)
    setActiveStoryId('my-story')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeChat={activeChat ?? ''}
        stories={stories}
        onSelectChat={(id) => {
          setActiveChat(id)
          closeStorySurface()
          setShowContactInfo(false)
          setUnreadCounts((prev) => ({ ...prev, [id]: 0 }))
        }}
        onAddStory={openStoryComposer}
        onOpenStory={openStoryViewer}
        unreadCounts={unreadCounts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedChats={selectedChats}
        onSelectChats={setSelectedChats}
        isOpen={sidebarOpen}
      />

      {activeStoryId ? (
        <StoryViewerScreen
          stories={stories.filter((story) => story.hasStory && !!story.caption)}
          activeStoryId={activeStoryId}
          onSelectStory={setActiveStoryId}
          onClose={closeStorySurface}
        />
      ) : showStoryComposer ? (
        <AddStoryScreen
          profileName={profile?.username ?? 'You'}
          profileAvatar={profile?.avatar_url}
          onSubmit={handleStorySubmit}
          onCancel={closeStorySurface}
        />
      ) : activeChat ? (
        <ChatWindow
          key={activeChat}
          activeChat={activeChat}
          messages={messages}
          onSendMessage={(content, type, replyToId, fileUrl) =>
            sendMessage({ conversationId: activeChat, content, type, replyToId, fileUrl })
          }
          onTyping={(isTyping) => sendTyping(activeChat, isTyping)}
          otherIsTyping={otherIsTyping}
          onReact={reactToMessage}
          onEdit={editMessage}
          onDelete={deleteMessage}
          onProfileClick={() => setShowContactInfo((v) => !v)}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center bg-sidebar p-6">
          <div className="flex w-full max-w-sm flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <UserPlus className="h-6 w-6 text-foreground" />
            </div>

            <h2 className="text-base font-semibold text-foreground">
              Add a contact to start chatting
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Start by adding someone to your contacts, then open a direct message.
            </p>

            <Button
              onClick={() => setShowAddContact(true)}
              className="mt-5 h-10 rounded-full px-5 text-sm"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showContactInfo && activeChat && (
          <InfoPanel
            activeChat={activeChat}
            onClose={() => setShowContactInfo(false)}
          />
        )}
      </AnimatePresence>

      {showAddContact && (
        <AddContactModal onClose={() => setShowAddContact(false)} />
      )}
    </div>
  )
}
