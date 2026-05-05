'use client'

import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { directConversationsApi, type BackendDirectMessage, type DirectConversation, toChatMessage } from '@/lib/direct-conversations-api'
import { directMessagesApi } from '@/lib/direct-messages-api'
import { getSocket } from '@/lib/socket'
import type { ChatMessage } from '@/hooks/use-messaging'

export const DIRECT_KEYS = {
  conversations: ['direct', 'conversations'] as const,
  messages: (conversationId: string) => ['direct', 'messages', conversationId] as const,
}

export function useDirectConversations() {
  return useQuery({
    queryKey: DIRECT_KEYS.conversations,
    queryFn: directConversationsApi.list,
    staleTime: 15_000,
  })
}

export function useCreateDirectConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (targetUserId: string) => directConversationsApi.create(targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DIRECT_KEYS.conversations })
    },
  })
}

export function useDirectMessages(conversationId?: string | null) {
  return useQuery({
    queryKey: DIRECT_KEYS.messages(conversationId ?? ''),
    queryFn: () => directConversationsApi.messages(conversationId!),
    enabled: Boolean(conversationId),
  })
}

export function useSendDirectMessage(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { content?: string; type?: string; fileUrl?: string | null; replyToId?: string | null; mime?: string; duration?: number; size?: number }) =>
      directConversationsApi.sendMessage(conversationId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DIRECT_KEYS.messages(conversationId) })
      queryClient.invalidateQueries({ queryKey: DIRECT_KEYS.conversations })
    },
  })
}

export function useToggleDirectMessageReaction(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      directMessagesApi.toggleDirectMessageReaction(messageId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DIRECT_KEYS.messages(conversationId) })
    },
  })
}

function upsertDirectMessage(messages: ChatMessage[], message: ChatMessage) {
  const next = messages.some((item) => item.id === message.id)
    ? messages.map((item) => item.id === message.id ? message : item)
    : [...messages, message]

  return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

function updateConversationPreview(conversation: DirectConversation, message: ChatMessage): DirectConversation {
  if (conversation.id !== message.conversation_id) return conversation
  return {
    ...conversation,
    last_message: [{
      id: message.id,
      content: message.content,
      type: message.type,
      file_url: message.file_url,
      sender_id: message.sender_id,
      created_at: message.created_at,
    }],
  }
}

interface DirectMessageRealtimeOptions {
  onIncomingMessage?: (message: ChatMessage, isVisibleConversation: boolean) => void
  readReceiptsEnabled?: boolean
}

export function useDirectMessageRealtime(
  conversationId?: string | null,
  currentUserId?: string | null,
  options: DirectMessageRealtimeOptions = {},
) {
  const queryClient = useQueryClient()
  const optionsRef = useRef(options)
  const handledIncomingIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    let mounted = true
    let cleanup: (() => void) | null = null

    getSocket().then((socket) => {
      if (!mounted) return

      const onDirectMessage = (raw: BackendDirectMessage) => {
        if (!mounted || !raw?.conversation_id) return
        const message = toChatMessage(raw)
        queryClient.setQueryData<ChatMessage[]>(DIRECT_KEYS.messages(message.conversation_id), (old = []) =>
          upsertDirectMessage(old, message),
        )
        queryClient.setQueryData<DirectConversation[]>(DIRECT_KEYS.conversations, (old = []) =>
          old.map((conversation) => updateConversationPreview(conversation, message)),
        )
        queryClient.invalidateQueries({ queryKey: DIRECT_KEYS.conversations })

        if (currentUserId && message.sender_id !== currentUserId) {
          if (handledIncomingIdsRef.current.has(message.id)) return
          handledIncomingIdsRef.current.add(message.id)

          const isVisibleConversation = message.conversation_id === conversationId
          optionsRef.current.onIncomingMessage?.(message, isVisibleConversation)

          socket.emit('directMessageDelivered', {
            conversationId: message.conversation_id,
            messageId: message.id,
          })

          if (isVisibleConversation && optionsRef.current.readReceiptsEnabled !== false) {
            socket.emit('markDirectRead', {
              conversationId: message.conversation_id,
              messageId: message.id,
            })
          }
        }
      }

      const onDirectMessageUpdated = (raw: BackendDirectMessage) => {
        if (!mounted || !raw?.conversation_id) return
        const message = toChatMessage(raw)
        queryClient.setQueryData<ChatMessage[]>(DIRECT_KEYS.messages(message.conversation_id), (old = []) =>
          upsertDirectMessage(old, message),
        )
      }

      const onDirectMessageDeleted = (payload: string | { conversationId?: string; messageId?: string }) => {
        const messageId = typeof payload === 'string' ? payload : payload.messageId
        const payloadConversationId = typeof payload === 'string' ? conversationId : payload.conversationId
        if (!mounted || !messageId || !payloadConversationId) return
        queryClient.setQueryData<ChatMessage[]>(DIRECT_KEYS.messages(payloadConversationId), (old = []) =>
          old.filter((message) => message.id !== messageId),
        )
        queryClient.invalidateQueries({ queryKey: DIRECT_KEYS.conversations })
      }

      const onDirectStatus = ({ messageId, conversationId, status }: { messageId: string; conversationId: string; status: ChatMessage['status'] }) => {
        if (!mounted || !messageId || !conversationId) return
        queryClient.setQueryData<ChatMessage[]>(DIRECT_KEYS.messages(conversationId), (old = []) =>
          old.map((message) => message.id === messageId ? { ...message, status } : message),
        )
      }

      const joinRoom = () => {
        if (conversationId) socket.emit('joinDirectRoom', conversationId)
      }

      joinRoom()
      socket.on('connect', joinRoom)
      socket.on('newDirectMessage', onDirectMessage)
      socket.on('newDirectMessageNotification', onDirectMessage)
      socket.on('directMessageUpdated', onDirectMessageUpdated)
      socket.on('directMessageDeleted', onDirectMessageDeleted)
      socket.on('directMessageStatusUpdate', onDirectStatus)

      cleanup = () => {
        socket.off('connect', joinRoom)
        socket.off('newDirectMessage', onDirectMessage)
        socket.off('newDirectMessageNotification', onDirectMessage)
        socket.off('directMessageUpdated', onDirectMessageUpdated)
        socket.off('directMessageDeleted', onDirectMessageDeleted)
        socket.off('directMessageStatusUpdate', onDirectStatus)
        if (conversationId) socket.emit('leaveRoom', `dm_${conversationId}`)
      }
    })

    return () => {
      mounted = false
      cleanup?.()
    }
  }, [conversationId, currentUserId, queryClient])
}

