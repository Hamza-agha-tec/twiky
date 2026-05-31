'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChatWindow } from '@/components/chat/chat-window'
import { useDirectMessages, useDirectConversations, useSendDirectMessage, useCreateDirectConversation } from '@/hooks/use-direct-conversations'
import { useProfile } from '@/hooks/use-user'
import { useDmCallContext } from '@/context/DmCallContext'
import { DirectProfileSidebar } from '@/components/chat/direct-profile-sidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { useOnlineUsers } from '@/hooks/use-socket'

export default function DirectMessagePage() {
  const { conversationId } = useParams()
  const router = useRouter()
  const { data: profile } = useProfile()
  const dmCall = useDmCallContext()
  const { mutate: createDm } = useCreateDirectConversation()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  
  const cId = conversationId as string

  // Handle Escape key to close sidebar or go back to DM home
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedProfileId) {
          setSelectedProfileId(null)
        } else {
          router.push('/dm')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router, selectedProfileId])
  
  const { data: messages = [] } = useDirectMessages(cId)
  const { data: conversations = [] } = useDirectConversations()
  
  const conversation = conversations.find(c => c.id === cId)
  const { mutate: sendMessage } = useSendDirectMessage(cId)
  const otherUser = conversation?.user_one?.id === profile?.id ? conversation?.user_two : conversation?.user_one
  
  const onlineUsers = useOnlineUsers()
  const isOnline = otherUser?.id ? onlineUsers.has(otherUser.id) : false

  return (
    <div className="flex h-full w-full overflow-hidden relative bg-background">
      <div className="flex-1 min-w-0 h-full">
        <ChatWindow
          activeChat={cId}
          chatOverride={{
            name: otherUser?.username || 'Direct Message',
            avatarUrl: otherUser?.avatar_url,
            isOnline: isOnline,
            isVerified: otherUser?.is_verified ?? undefined,
            subPlan: otherUser?.sub_plan,
          }}
          messages={messages as any}
          onSendMessage={(content) => sendMessage(content)}
          onProfileClick={() => {
            if (otherUser?.id) setSelectedProfileId(otherUser.id)
          }}
          onViewMessageProfile={(userId) => {
            setSelectedProfileId(userId)
          }}
          onStartDirectMessage={(userId) => {
            createDm(userId, {
              onSuccess: (data) => {
                if (data?.id) {
                  router.push(`/dm/${data.id}`)
                }
              }
            })
          }}
          onVoiceCall={otherUser?.id ? () => dmCall.startCall(cId, otherUser.id, otherUser.username || 'User', otherUser.avatar_url, 'audio') : undefined}
          onVideoCall={otherUser?.id ? () => dmCall.startCall(cId, otherUser.id, otherUser.username || 'User', otherUser.avatar_url, 'video') : undefined}
        />
      </div>

      <AnimatePresence>
        {selectedProfileId && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-shrink-0 border-l border-border bg-sidebar hidden lg:block h-full z-10 absolute right-0 top-0 bottom-0 shadow-2xl lg:relative lg:shadow-none overflow-hidden"
          >
            <div className="w-[300px] h-full">
              <DirectProfileSidebar
                userId={selectedProfileId}
                onClose={() => setSelectedProfileId(null)}
                chatOverride={selectedProfileId === otherUser?.id ? {
                  name: otherUser?.username || 'User',
                  avatarUrl: otherUser?.avatar_url,
                  isVerified: otherUser?.is_verified ?? undefined,
                  subPlan: otherUser?.sub_plan,
                } : undefined}
                onOpenPixelRoom={(username) => {
                  setSelectedProfileId(null)
                  router.push(`/room/${username}`)
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
