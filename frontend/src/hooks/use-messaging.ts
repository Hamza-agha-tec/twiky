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
  last_message_at: string | null;
  created_at: string;
  participants: ConversationParticipant[];
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: 'text' | 'image' | 'file' | 'voice';
  file_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  sender: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

/** For a DM, returns the other participant's user object. For groups, returns null. */
export function getDmContact(conv: Conversation, myId: string) {
  if (conv.is_group) return null;
  return conv.participants?.find((p) => p.user.id !== myId)?.user ?? null;
}

export function getConvDisplayName(
  conv: Conversation,
  myId: string,
  contacts?: { id: string; nickname: string | null; username: string | null }[],
): string {
  if (conv.is_group) return conv.name ?? 'Group';
  const participant = getDmContact(conv, myId);
  if (!participant) return conv.name ?? 'Unknown';
  const contact = contacts?.find((c) => c.id === participant.id);
  return contact?.nickname || contact?.username || participant.username || 'Unknown';
}

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: MESSAGING_KEYS.conversations,
    queryFn: messagingApi.getConversations,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: messagingApi.createConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MESSAGING_KEYS.conversations }),
  });
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
