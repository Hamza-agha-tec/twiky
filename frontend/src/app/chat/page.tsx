'use client'

import { useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { UserPlus } from 'lucide-react'

import { AddContactModal } from '@/components/chat/add-contact-modal'
import { ChatWindow } from '@/components/chat/chat-window'
import { InfoPanel } from '@/components/chat/info-panel'
import { Sidebar } from '@/components/chat/sidebar'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/hooks/use-messaging'
import { useSocket, useGlobalSocket } from '@/hooks/use-socket'

export default function ChatPage() {
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [selectedChats, setSelectedChats] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen] = useState(true)
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  const handleNewMessage = useCallback((convId: string) => {
    setUnreadCounts((prev) => {
      if (convId === activeChat) return prev;
      return { ...prev, [convId]: (prev[convId] ?? 0) + 1 };
    });
  }, [activeChat]);

  const { data: messages = [] } = useMessages(activeChat)
  const { sendMessage, sendTyping, otherIsTyping, reactToMessage, editMessage, deleteMessage } = useSocket(activeChat)
  useGlobalSocket(handleNewMessage)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeChat={activeChat ?? ''}
        onSelectChat={(id) => {
          setActiveChat(id)
          setShowContactInfo(false)
          setUnreadCounts((prev) => ({ ...prev, [id]: 0 }))
        }}
        unreadCounts={unreadCounts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedChats={selectedChats}
        onSelectChats={setSelectedChats}
        isOpen={sidebarOpen}
      />

      {activeChat ? (
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
