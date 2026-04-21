'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type BackendChannel, channelApi } from '@/lib/channel-api';

export const CHANNEL_KEYS = {
  all: ['channels'] as const,
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
