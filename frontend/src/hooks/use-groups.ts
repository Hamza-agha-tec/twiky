'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type BackendGroup, groupsApi } from '@/lib/groups-api';

export const GROUP_KEYS = {
  byChannel: (channelId: string) => ['groups', 'channel', channelId] as const,
  members: (groupId: string) => ['groups', groupId, 'members'] as const,
  messages: (groupId: string) => ['groups', groupId, 'messages'] as const,
};

export function useChannelGroups(channelId: string | undefined) {
  return useQuery({
    queryKey: GROUP_KEYS.byChannel(channelId ?? ''),
    queryFn: () => groupsApi.getChannelGroups(channelId!),
    enabled: !!channelId,
    staleTime: 30_000,
  });
}

export function useCreateGroup(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      groupsApi.createGroup(channelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.byChannel(channelId) });
    },
  });
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: GROUP_KEYS.members(groupId ?? ''),
    queryFn: () => groupsApi.getGroupMembers(groupId!),
    enabled: !!groupId,
  });
}

export function useAddGroupMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { user_id: string; role?: 'ADMIN' | 'MEMBER' }) =>
      groupsApi.addGroupMember(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.members(groupId) });
    },
  });
}

export function useGroupMessages(groupId: string | undefined) {
  return useQuery({
    queryKey: GROUP_KEYS.messages(groupId ?? ''),
    queryFn: () => groupsApi.getGroupMessages(groupId!),
    enabled: !!groupId,
  });
}

export function useSendGroupMessage(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { content: string; fileUrl?: string; replyToId?: string | null }) =>
      groupsApi.sendGroupMessage(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.messages(groupId) });
    },
  });
}

export function useToggleGroupMessageReaction(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { messageId: string; emoji: string }) =>
      groupsApi.toggleGroupMessageReaction(data.messageId, data.emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.messages(groupId) });
    },
  });
}

export function useUpdateGroupMemberRole(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { user_id: string; role: 'ADMIN' | 'MEMBER' }) =>
      groupsApi.updateMemberRole(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.members(groupId) });
    },
  });
}

export function useRemoveGroupMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => groupsApi.removeGroupMember(groupId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.members(groupId) });
    },
  });
}

export function useDeleteGroup(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => groupsApi.deleteGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.byChannel(channelId) });
    },
  });
}

export function backendGroupToMock(group: BackendGroup) {
  return {
    id: group.id,
    label: group.name,
    description: group.description ?? '',
    kind: 'text' as const,
    membersLabel: '',
    pinnedBy: '',
    pinnedMessage: '',
  };
}
