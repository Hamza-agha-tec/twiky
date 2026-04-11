'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'

import { ChatWindow } from '@/components/chat/chat-window'
import { InfoPanel } from '@/components/chat/info-panel'
import { Sidebar } from '@/components/chat/sidebar'
import { useMessages } from '@/hooks/use-messaging'
import { useSocket } from '@/hooks/use-socket'

export default function ChatPage() {
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [selectedChats, setSelectedChats] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen] = useState(true)
  const [showContactInfo, setShowContactInfo] = useState(false)

  const { data: messages = [] } = useMessages(activeChat)
  const { sendMessage, sendTyping, otherIsTyping } = useSocket(activeChat)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeChat={activeChat ?? ''}
        onSelectChat={(id) => {
          setActiveChat(id)
          setShowContactInfo(false)
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedChats={selectedChats}
        onSelectChats={setSelectedChats}
        isOpen={sidebarOpen}
      />

      {activeChat ? (
        <ChatWindow
          activeChat={activeChat}
          messages={messages}
          onSendMessage={(content, type, replyToId) =>
            sendMessage({ conversationId: activeChat, content, type, replyToId })
          }
          onTyping={(isTyping) => sendTyping(activeChat, isTyping)}
          otherIsTyping={otherIsTyping}
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
