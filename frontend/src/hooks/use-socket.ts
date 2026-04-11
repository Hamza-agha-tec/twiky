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

      s.on('reactionUpdate', ({ messageId, reactions }: { messageId: string; reactions: { userId: string; emoji: string }[] }) => {
        queryClient.setQueryData<ChatMessage[]>(
          MESSAGING_KEYS.messages(conversationId),
          (old = []) => old.map((m) => m.id === messageId ? { ...m, reactions } : m)
        );
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
    fileUrl?: string;
  }) => {
    socketRef.current?.emit('sendMessage', payload);
  }, []);

  const sendTyping = useCallback((convId: string, isTyping: boolean) => {
    socketRef.current?.emit('typing', { conversationId: convId, isTyping });
  }, []);

  const reactToMessage = useCallback((messageId: string, emoji: string) => {
    socketRef.current?.emit('reactToMessage', { messageId, conversationId, emoji });
  }, [conversationId]);

  const editMessage = useCallback((messageId: string, content: string) => {
    socketRef.current?.emit('editMessage', { messageId, conversationId, content });
  }, [conversationId]);

  const deleteMessage = useCallback((messageId: string) => {
    socketRef.current?.emit('deleteMessage', { messageId, conversationId });
  }, [conversationId]);

  return { sendMessage, sendTyping, otherIsTyping, reactToMessage, editMessage, deleteMessage };
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
