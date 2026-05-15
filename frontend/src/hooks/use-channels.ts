'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type BackendChannel, channelApi } from '@/lib/channel-api';
import { type Channel, type ChannelMember, type ChannelJoinRequest, channelsApi } from '@/lib/channels-api';
import { getSocket } from '@/lib/socket';

export const CHANNEL_KEYS = {
  all: ['channels'] as const,
  detail: (id: string) => ['channels', id] as const,
  inviteLink: (id: string) => ['channels', id, 'invite-link'] as const,
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
    onError: (error) => {
      console.error('Error creating channel:', error);
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

export const DISCOVER_KEYS = {
  all: ['channels', 'discover'] as const,
};

export function useDiscoverChannels() {
  return useQuery<Channel[]>({
    queryKey: DISCOVER_KEYS.all,
    queryFn: channelsApi.discoverChannels,
  });
}

export function useJoinChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channelId: string) => channelsApi.joinChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.all });
      queryClient.invalidateQueries({ queryKey: DISCOVER_KEYS.all });
    },
  });
}

export function useChannelInviteLink(channelId: string | undefined) {
  return useQuery({
    queryKey: CHANNEL_KEYS.inviteLink(channelId ?? ''),
    queryFn: () => channelApi.getInviteLink(channelId!),
    enabled: !!channelId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeleteChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => channelApi.deleteChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.all });
    },
  });
}

export function useRequestJoinChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channelId: string) => channelsApi.requestJoinChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISCOVER_KEYS.all });
    },
  });
}

export const CHANNEL_MEMBER_KEYS = {
  members: (channelId: string) => ['channel-members', channelId] as const,
  joinRequests: (channelId: string) => ['channel-join-requests', channelId] as const,
};

export function useChannelMembers(channelId: string | undefined) {
  return useQuery<ChannelMember[]>({
    queryKey: CHANNEL_MEMBER_KEYS.members(channelId ?? ''),
    queryFn: () => channelsApi.getMembers(channelId!),
    enabled: !!channelId,
  });
}

export function useAddChannelMember(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role = 'MEMBER' }: { userId: string; role?: 'ADMIN' | 'MEMBER' }) =>
      channelsApi.addMember(channelId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_MEMBER_KEYS.members(channelId) });
    },
  });
}

export function useKickChannelMember(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => channelsApi.kickMember(channelId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_MEMBER_KEYS.members(channelId) });
    },
  });
}

export function useChannelJoinRequests(channelId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!channelId) return;
    let mounted = true;
    let cleanup: (() => void) | null = null;

    getSocket().then((socket) => {
      if (!mounted) return;
      const handler = (data: { channelId: string }) => {
        if (data.channelId === channelId) {
          queryClient.invalidateQueries({ queryKey: CHANNEL_MEMBER_KEYS.joinRequests(channelId) });
        }
      };
      socket.on('channelJoinRequest', handler);
      cleanup = () => socket.off('channelJoinRequest', handler);
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [channelId, queryClient]);

  return useQuery<ChannelJoinRequest[]>({
    queryKey: CHANNEL_MEMBER_KEYS.joinRequests(channelId ?? ''),
    queryFn: () => channelsApi.getJoinRequests(channelId!),
    enabled: !!channelId,
  });
}

export function useChannelsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;

    getSocket().then((socket) => {
      if (!mounted) return;

      const invalidate = () => {
        if (!mounted) return;
        queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.all });
      };

      const onChannelDeleted = (payload: { channelId?: string }) => {
        if (!mounted) return;
        queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.all });
        if (payload?.channelId) {
          queryClient.removeQueries({ queryKey: CHANNEL_KEYS.detail(payload.channelId) });
        }
      };

      socket.on('channelCreated', invalidate);
      socket.on('channelUpdated', invalidate);
      socket.on('channelDeleted', onChannelDeleted);

      cleanup = () => {
        socket.off('channelCreated', invalidate);
        socket.off('channelUpdated', invalidate);
        socket.off('channelDeleted', onChannelDeleted);
      };
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [queryClient]);
}

export function useRespondToChannelJoinRequest(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: 'ACCEPTED' | 'REJECTED' }) =>
      channelsApi.respondToJoinRequest(channelId, requestId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_MEMBER_KEYS.joinRequests(channelId) });
      queryClient.invalidateQueries({ queryKey: CHANNEL_MEMBER_KEYS.members(channelId) });
    },
  });
}
