'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';
import { MESSAGING_KEYS, ChatMessage, Conversation } from './use-messaging';

export function useSocket(conversationId: string | null) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const reconnectRef = useRef<(() => void) | null>(null);
  const [otherIsTyping, setOtherIsTyping] = useState(false);

  useEffect(() => {
    if (!conversationId) return;

    let mounted = true;

    // Named handlers so we can remove them specifically
    const onNewMessage = (message: ChatMessage) => {
      if (message.conversation_id !== conversationId) return;
      queryClient.setQueryData<ChatMessage[]>(
        MESSAGING_KEYS.messages(conversationId),
        (old = []) => {
          if (old.some((m) => m.id === message.id)) return old;
          return [message, ...old];
        }
      );
      queryClient.setQueryData<Conversation[]>(
        MESSAGING_KEYS.conversations,
        (old = []) => old.map((c) =>
          c.id === conversationId ? { ...c, last_message_at: message.created_at } : c
        )
      );
      socketRef.current?.emit('messageDelivered', { messageId: message.id, conversationId });
      socketRef.current?.emit('markRead', { conversationId });
    };

    const onMessageUpdated = (updated: ChatMessage) => {
      queryClient.setQueryData<ChatMessage[]>(
        MESSAGING_KEYS.messages(conversationId),
        (old = []) => old.map((m) => (m.id === updated.id ? updated : m))
      );
    };

    const onMessageDeleted = (messageId: string) => {
      queryClient.setQueryData<ChatMessage[]>(
        MESSAGING_KEYS.messages(conversationId),
        (old = []) => old.filter((m) => m.id !== messageId)
      );
    };

    const onReactionUpdate = ({ messageId, reactions }: { messageId: string; reactions: { userId: string; emoji: string }[] }) => {
      queryClient.setQueryData<ChatMessage[]>(
        MESSAGING_KEYS.messages(conversationId),
        (old = []) => old.map((m) => m.id === messageId ? { ...m, reactions } : m)
      );
    };

    const onMessageStatusUpdate = ({ messageId, status }: { messageId: string; status: string }) => {
      queryClient.setQueryData<ChatMessage[]>(
        MESSAGING_KEYS.messages(conversationId),
        (old = []) => old.map((m) => m.id === messageId ? { ...m, status: status as ChatMessage['status'] } : m)
      );
    };

    const onMessagesRead = ({ messageIds }: { messageIds: string[] }) => {
      const ids = new Set(messageIds);
      queryClient.setQueryData<ChatMessage[]>(
        MESSAGING_KEYS.messages(conversationId),
        (old = []) => old.map((m) => ids.has(m.id) ? { ...m, status: 'read' as const } : m)
      );
    };

    const onUserTyping = ({ isTyping }: { userId: string; isTyping: boolean }) => {
      if (mounted) setOtherIsTyping(isTyping);
    };

    getSocket().then((s) => {
      if (!mounted) return;
      socketRef.current = s;

      s.emit('joinConversation', conversationId);
      s.emit('markRead', { conversationId });

      reconnectRef.current = () => {
        if (mounted) s.emit('joinConversation', conversationId);
      };
      s.on('connect', reconnectRef.current);

      s.on('newMessage', onNewMessage);
      s.on('messageUpdated', onMessageUpdated);
      s.on('messageDeleted', onMessageDeleted);
      s.on('reactionUpdate', onReactionUpdate);
      s.on('messageStatusUpdate', onMessageStatusUpdate);
      s.on('messagesRead', onMessagesRead);
      s.on('userTyping', onUserTyping);
    });

    return () => {
      mounted = false;
      setOtherIsTyping(false);
      const s = socketRef.current;
      if (reconnectRef.current) s?.off('connect', reconnectRef.current);
      s?.off('newMessage', onNewMessage);
      s?.off('messageUpdated', onMessageUpdated);
      s?.off('messageDeleted', onMessageDeleted);
      s?.off('reactionUpdate', onReactionUpdate);
      s?.off('messageStatusUpdate', onMessageStatusUpdate);
      s?.off('messagesRead', onMessagesRead);
      s?.off('userTyping', onUserTyping);
      s?.emit('leaveConversation', conversationId);
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

/**
 * Global listener — receives newMessage for ALL conversations via the personal
 * user room that the backend auto-joins on connect. Updates the sidebar in real-time.
 */
export function useGlobalSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;

    getSocket().then((s) => {
      if (!mounted) return;

      const onNewMessage = (message: ChatMessage) => {
        if (!mounted) return;
        // Update messages cache only if already loaded (don't create empty caches)
        queryClient.setQueryData<ChatMessage[]>(
          MESSAGING_KEYS.messages(message.conversation_id),
          (old) => {
            if (!old) return old;
            if (old.some((m) => m.id === message.id)) return old;
            return [message, ...old];
          }
        );
        // Always bump sidebar timestamp
        queryClient.setQueryData<Conversation[]>(
          MESSAGING_KEYS.conversations,
          (old = []) => old.map((c) =>
            c.id === message.conversation_id
              ? { ...c, last_message_at: message.created_at }
              : c
          )
        );
      };

      s.on('newMessage', onNewMessage);
      cleanup = () => s.off('newMessage', onNewMessage);
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [queryClient]);
}

export function useTypingIndicator(conversationId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const typingUsers = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!conversationId) return;

    const onUserTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      if (isTyping) typingUsers.current.add(userId);
      else typingUsers.current.delete(userId);
    };

    getSocket().then((s) => {
      socketRef.current = s;
      s.on('userTyping', onUserTyping);
    });

    return () => {
      socketRef.current?.off('userTyping', onUserTyping);
    };
  }, [conversationId]);

  return typingUsers;
}
