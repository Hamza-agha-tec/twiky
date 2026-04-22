'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Notification, notificationsApi } from '@/lib/notifications-api';

export const NOTIFICATION_KEYS = {
  all: ['notifications'] as const,
};

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: NOTIFICATION_KEYS.all,
    queryFn: notificationsApi.getAll,
    refetchInterval: 15000,
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
