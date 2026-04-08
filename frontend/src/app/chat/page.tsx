'use client'

import { useState } from 'react'

import { ChatWindow } from '@/components/chat/chat-window'
import { InfoPanel } from '@/components/chat/info-panel'
import { Sidebar } from '@/components/chat/sidebar'
import { type Message, messagesData } from '@/lib/mock-data'

export default function ChatPage() {
  const [activeChat, setActiveChat] = useState('alice')
  const [selectedChats, setSelectedChats] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [messages, setMessages] =
    useState<Record<string, Message[]>>(messagesData)
  const [sidebarOpen] = useState(true)
  const [showContactInfo, setShowContactInfo] = useState(false)

  const handleSendMessage = (
    content: string,
    type: Message['type'] = 'text',
  ) => {
    if (!content.trim()) {
      return
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: 'me',
      senderName: 'You',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
      content,
      type,
      timestamp: new Date().toISOString(),
      isOwn: true,
      isRead: true,
      isDelivered: true,
      duration: type === 'video' ? '0:45' : undefined,
    }

    setMessages((prev) => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), newMessage],
    }))
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeChat={activeChat}
        onSelectChat={setActiveChat}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedChats={selectedChats}
        onSelectChats={setSelectedChats}
        isOpen={sidebarOpen}
      />
      {showContactInfo ? (
        <InfoPanel
          activeChat={activeChat}
          onClose={() => setShowContactInfo(false)}
        />
      ) : (
        <ChatWindow
          activeChat={activeChat}
          messages={messages[activeChat] || []}
          onSendMessage={handleSendMessage}
          onProfileClick={() => setShowContactInfo(true)}
        />
      )}
    </div>
  )
}
