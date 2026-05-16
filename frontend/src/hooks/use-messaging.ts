'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagingApi } from '@/lib/messaging-api';

export const MESSAGING_KEYS = {
  conversations: ['messaging', 'conversations'] as const,
  messages: (id: string) => ['messaging', 'messages', id] as const,
};

export interface ConversationParticipant {
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
    phone_number: string | null;
  };
}

export interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  avatar_url: string | null;
  last_message_at: string | null;
  created_at: string;
  participants: ConversationParticipant[];
  last_message: {
    id: string;
    conversation_id: string;
    content: string | null;
    type: string;
    created_at: string;
    sender: { id: string; username: string };
  } | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: 'text' | 'image' | 'file' | 'voice' | 'call' | 'gif' | 'sticker';
  file_url: string | null;
  metadata: Record<string, unknown>;
  status: 'sent' | 'delivered' | 'read';
  reactions: { userId: string; emoji: string }[];
  reply_to: { id: string; content: string | null; sender: { id: string; username: string } } | null;
  is_pinned?: boolean;
  is_forwarded?: boolean;
  created_at: string;
  sender: {
    id: string;
    email?: string | null;
    username: string;
    avatar_url: string | null;
    is_verified?: boolean | null;
    sub_plan?: 'FREE' | 'PRO' | 'GEEK' | null;
  };
}

export function useMessages(conversationId: string | null) {
  return useQuery<ChatMessage[]>({
    queryKey: MESSAGING_KEYS.messages(conversationId ?? ''),
    queryFn: () => messagingApi.getMessages(conversationId!),
    enabled: !!conversationId,
  });
}

export function useEditMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      messagingApi.editMessage(id, content),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: MESSAGING_KEYS.messages(conversationId) }),
  });
}

export function useDeleteMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messagingApi.deleteMessage(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: MESSAGING_KEYS.messages(conversationId) }),
  });
}

export function useReactToMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) =>
      messagingApi.reactToMessage(id, emoji),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: MESSAGING_KEYS.messages(conversationId) }),
  });
}

export function useUploadFile() {
  return useMutation({
    mutationFn: messagingApi.uploadFile,
  });
}
