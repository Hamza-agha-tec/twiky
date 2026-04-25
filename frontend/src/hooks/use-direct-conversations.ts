'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { directConversationsApi } from '@/lib/direct-conversations-api'

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

