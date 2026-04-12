'use client'

import { useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'

import { ChatWindow } from '@/components/chat/chat-window'
import { InfoPanel } from '@/components/chat/info-panel'
import { Sidebar } from '@/components/chat/sidebar'
import { useMessages } from '@/hooks/use-messaging'
import { useSocket, useGlobalSocket } from '@/hooks/use-socket'

export default function ChatPage() {
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [selectedChats, setSelectedChats] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen] = useState(true)
  const [showContactInfo, setShowContactInfo] = useState(false)
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
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Select a conversation to start chatting
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
    </div>
  )
}
