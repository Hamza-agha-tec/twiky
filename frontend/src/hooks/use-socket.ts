'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';
import { MESSAGING_KEYS, ChatMessage, Conversation } from './use-messaging';
import { DIRECT_KEYS } from './use-direct-conversations';
import type { DirectConversation } from '@/lib/direct-conversations-api';

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
export function useGlobalSocket(onNewMessage?: (conversationId: string) => void) {
  const queryClient = useQueryClient();
  const onNewMessageRef = useRef(onNewMessage);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;

    getSocket().then((s) => {
      if (!mounted) return;

      const onNewMessage = (message: ChatMessage) => {
        if (!mounted) return;
        
        let conversationExists = false;

        // Update messages cache only if already loaded (don't create empty caches)
        queryClient.setQueryData<ChatMessage[]>(
          MESSAGING_KEYS.messages(message.conversation_id),
          (old) => {
            if (!old) return old;
            if (old.some((m) => m.id === message.id)) return old;
            return [message, ...old];
          }
        );

        // Bump sidebar timestamp + last_message
        queryClient.setQueryData<Conversation[]>(
          MESSAGING_KEYS.conversations,
          (old = []) => {
            conversationExists = old.some(c => c.id === message.conversation_id);
            return old.map((c) =>
              c.id === message.conversation_id
                ? {
                    ...c,
                    last_message_at: message.created_at,
                    last_message: {
                      id: message.id,
                      conversation_id: message.conversation_id,
                      content: message.content,
                      type: message.type,
                      created_at: message.created_at,
                      sender: message.sender,
                    },
                  }
                : c
            );
          }
        );

        onNewMessageRef.current?.(message.conversation_id);

        if (!conversationExists) {
          queryClient.invalidateQueries({ queryKey: MESSAGING_KEYS.conversations });
        }
      };

      const onReactionUpdate = ({ conversationId, emoji, reactorId, messageType, messageSenderId, isAdded }: {
        conversationId: string; emoji: string; reactorId: string;
        messageType: string; messageSenderId: string; messageId: string; isAdded: boolean;
      }) => {
        if (!mounted || !conversationId) return;
        queryClient.setQueryData<Conversation[]>(
          MESSAGING_KEYS.conversations,
          (old = []) => old.map((c) => {
            if (c.id !== conversationId) return c;
            const lastMsg = c.last_message as any;
            if (isAdded) {
              return {
                ...c,
                last_message_at: new Date().toISOString(),
                last_message: { ...lastMsg, _reactionPreview: { emoji, reactorId, messageType, messageSenderId } },
              };
            } else {
              // Reaction removed — clear preview if it was showing this reaction
              const preview = lastMsg?._reactionPreview;
              if (preview?.emoji === emoji && preview?.reactorId === reactorId) {
                const { _reactionPreview, ...rest } = lastMsg;
                return { ...c, last_message: rest };
              }
              return c;
            }
          })
        );
      };

      s.on('newMessage', onNewMessage);
      s.on('reactionUpdate', onReactionUpdate);

      cleanup = () => {
        s.off('newMessage', onNewMessage);
        s.off('reactionUpdate', onReactionUpdate);
      };
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [queryClient]);
}

export function usePresenceSocket(enabled: boolean = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    let cleanup: (() => void) | null = null;

    getSocket().then((s) => {
      if (!mounted) return;

      const onUserStatusChange = ({ userId, status, lastSeenAt }: { userId: string; status: 'online' | 'offline'; lastSeenAt?: string }) => {
        queryClient.setQueryData<Set<string>>(['messaging', 'online-users'], (prev = new Set()) => {
          const next = new Set(prev);
          if (status === 'online') next.add(userId);
          else next.delete(userId);
          return next;
        });
        if (status === 'offline') {
          const ts = lastSeenAt ? new Date(lastSeenAt).getTime() : Date.now();
          queryClient.setQueryData<Record<string, number>>(['messaging', 'last-seen'], (prev = {}) => ({
            ...prev,
            [userId]: ts,
          }));
        }
      };

      const onLastSeenMap = (map: Record<string, string>) => {
        if (!mounted) return;
        queryClient.setQueryData<Record<string, number>>(['messaging', 'last-seen'], (prev = {}) => {
          const next = { ...prev };
          for (const [id, iso] of Object.entries(map)) {
            next[id] = new Date(iso).getTime();
          }
          return next;
        });
      };

      const onOnlineUsersList = (userIds: string[]) => {
        if (!mounted) return;
        queryClient.setQueryData(['messaging', 'online-users'], new Set(userIds));
      };

      const syncOnlineUsers = () => {
        s.emit('getOnlineUsers');
      };

      const onPresencePrivacyChanged = ({ userId }: { userId?: string }) => {
        if (!mounted || !userId) return;

        queryClient.setQueryData<Record<string, number>>(['messaging', 'last-seen'], (prev = {}) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
        queryClient.setQueryData<DirectConversation[]>(DIRECT_KEYS.conversations, (old = []) =>
          old.map((conversation) => ({
            ...conversation,
            user_one: conversation.user_one?.id === userId
              ? { ...conversation.user_one, last_seen_at: null, last_seen_hidden: true }
              : conversation.user_one,
            user_two: conversation.user_two?.id === userId
              ? { ...conversation.user_two, last_seen_at: null, last_seen_hidden: true }
              : conversation.user_two,
          })),
        );
        queryClient.invalidateQueries({ queryKey: DIRECT_KEYS.conversations });
        syncOnlineUsers();
      };

      s.on('userStatusChange', onUserStatusChange);
      s.on('lastSeenMap', onLastSeenMap);
      s.on('onlineUsersList', onOnlineUsersList);
      s.on('presencePrivacyChanged', onPresencePrivacyChanged);
      s.on('connect', syncOnlineUsers);

      syncOnlineUsers();

      cleanup = () => {
        s.off('userStatusChange', onUserStatusChange);
        s.off('lastSeenMap', onLastSeenMap);
        s.off('onlineUsersList', onOnlineUsersList);
        s.off('presencePrivacyChanged', onPresencePrivacyChanged);
        s.off('connect', syncOnlineUsers);
      };
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [enabled, queryClient]);
}

export function useOnlineUsers() {
  const { data: onlineUsers = new Set<string>() } = useQuery({
    queryKey: ['messaging', 'online-users'],
    queryFn: async () => new Set<string>(),
    initialData: new Set<string>(),
    staleTime: Infinity,
  });
  return onlineUsers;
}

export function useLastSeen(userId: string | null) {
  const { data: lastSeen = {} } = useQuery<Record<string, number>>({
    queryKey: ['messaging', 'last-seen'],
    queryFn: async () => ({}),
    initialData: {},
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!userId) return;
    if (lastSeen[userId]) return; // already have it
    getSocket().then((s) => s.emit('getLastSeen', [userId]));
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!userId) return null;
  return lastSeen[userId] ?? null;
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
