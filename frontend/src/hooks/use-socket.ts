'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';
import { MESSAGING_KEYS, ChatMessage } from './use-messaging';

export function useSocket(conversationId: string | null) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [otherIsTyping, setOtherIsTyping] = useState(false);

  useEffect(() => {
    if (!conversationId) return;

    let mounted = true;

    getSocket().then((s) => {
      if (!mounted) return;
      socketRef.current = s;

      s.emit('joinConversation', conversationId);

      s.on('newMessage', (message: ChatMessage) => {
        queryClient.setQueryData<ChatMessage[]>(
          MESSAGING_KEYS.messages(conversationId),
          (old = []) => [message, ...old]
        );
        // Confirm delivery to sender
        socketRef.current?.emit('messageDelivered', { messageId: message.id, conversationId });
        // Mark as read since the conversation is currently open
        socketRef.current?.emit('markRead', { conversationId });
      });

      s.on('messageUpdated', (updated: ChatMessage) => {
        queryClient.setQueryData<ChatMessage[]>(
          MESSAGING_KEYS.messages(conversationId),
          (old = []) => old.map((m) => (m.id === updated.id ? updated : m))
        );
      });

      s.on('messageDeleted', (messageId: string) => {
        queryClient.setQueryData<ChatMessage[]>(
          MESSAGING_KEYS.messages(conversationId),
          (old = []) => old.filter((m) => m.id !== messageId)
        );
      });

      s.on('reactionUpdate', () => {
        queryClient.invalidateQueries({ queryKey: MESSAGING_KEYS.messages(conversationId) });
      });

      s.on('messageStatusUpdate', ({ messageId, status }: { messageId: string; status: string }) => {
        queryClient.setQueryData<ChatMessage[]>(
          MESSAGING_KEYS.messages(conversationId),
          (old = []) => old.map((m) => m.id === messageId ? { ...m, status: status as ChatMessage['status'] } : m)
        );
      });

      s.on('messagesRead', ({ messageIds }: { messageIds: string[] }) => {
        const ids = new Set(messageIds);
        queryClient.setQueryData<ChatMessage[]>(
          MESSAGING_KEYS.messages(conversationId),
          (old = []) => old.map((m) => ids.has(m.id) ? { ...m, status: 'read' as const } : m)
        );
      });

      s.on('userTyping', ({ isTyping }: { userId: string; isTyping: boolean }) => {
        if (mounted) setOtherIsTyping(isTyping);
      });

      // Mark existing unread messages as read when opening conversation
      s.emit('markRead', { conversationId });
    });

    return () => {
      mounted = false;
      setOtherIsTyping(false);
      socketRef.current?.off('newMessage');
      socketRef.current?.off('messageUpdated');
      socketRef.current?.off('messageDeleted');
      socketRef.current?.off('reactionUpdate');
      socketRef.current?.off('messageStatusUpdate');
      socketRef.current?.off('messagesRead');
      socketRef.current?.off('userTyping');
      socketRef.current?.emit('leaveConversation', conversationId);
    };
  }, [conversationId, queryClient]);

  const sendMessage = useCallback((payload: {
    conversationId: string;
    content: string;
    type?: string;
    replyToId?: string;
  }) => {
    socketRef.current?.emit('sendMessage', payload);
  }, []);

  const sendTyping = useCallback((convId: string, isTyping: boolean) => {
    socketRef.current?.emit('typing', { conversationId: convId, isTyping });
  }, []);

  return { sendMessage, sendTyping, otherIsTyping };
}

export function useTypingIndicator(conversationId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const typingUsers = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!conversationId) return;

    getSocket().then((s) => {
      socketRef.current = s;
      s.on('userTyping', ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
        if (isTyping) typingUsers.current.add(userId);
        else typingUsers.current.delete(userId);
      });
    });

    return () => {
      socketRef.current?.off('userTyping');
    };
  }, [conversationId]);

  return typingUsers;
}
