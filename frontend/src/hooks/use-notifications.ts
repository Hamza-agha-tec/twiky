'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Notification, notificationsApi } from '@/lib/notifications-api';
import { getSocket } from '@/lib/socket';

export const NOTIFICATION_KEYS = {
  all: ['notifications'] as const,
};

export function useNotifications() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;

    getSocket().then((socket) => {
      if (!mounted) return;
      const handler = () => {
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
      };
      socket.on('new_notification', handler);
      cleanup = () => socket.off('new_notification', handler);
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [queryClient]);

  return useQuery<Notification[]>({
    queryKey: NOTIFICATION_KEYS.all,
    queryFn: notificationsApi.getAll,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all }),
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all }),
  });
}
