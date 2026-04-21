'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type BackendChannel, channelApi } from '@/lib/channel-api';
import { type Channel, channelsApi } from '@/lib/channels-api';

export const CHANNEL_KEYS = {
  all: ['channels'] as const,
  detail: (id: string) => ['channels', id] as const,
};

export function useChannels() {
  return useQuery<BackendChannel[]>({
    queryKey: CHANNEL_KEYS.all,
    queryFn: channelApi.getChannels,
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: channelApi.createChannel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.all });
    },
  });
}

export function useUpdateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Channel, 'id' | 'owner_id' | 'created_at'>> }) =>
      channelsApi.updateChannel(id, data),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.detail(id) });
    },
  });
}
