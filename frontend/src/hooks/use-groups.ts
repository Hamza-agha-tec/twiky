'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type BackendGroup, type GroupMessage, groupsApi } from '@/lib/groups-api';
import { getSocket } from '@/lib/socket';
export { type BackendGroup };

export const GROUP_KEYS = {
  byChannel: (channelId: string) => ['groups', 'channel', channelId] as const,
  members: (groupId: string) => ['groups', groupId, 'members'] as const,
  messages: (groupId: string) => ['groups', groupId, 'messages'] as const,
  joinRequests: (groupId: string) => ['groups', groupId, 'join-requests'] as const,
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
    mutationFn: (data: { name: string; description?: string; group_type?: 'text' | 'voice' | 'watch'; access_type?: 'PUBLIC' | 'PRIVATE' }) =>
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

export function useToggleGroupMessageReaction(_groupId: string) {
  return useMutation({
    mutationFn: (data: { messageId: string; emoji: string }) =>
      groupsApi.toggleGroupMessageReaction(data.messageId, data.emoji),
  });
}

function upsertGroupMessage(messages: GroupMessage[], message: GroupMessage) {
  const next = messages.some((item) => item.id === message.id)
    ? messages.map((item) => item.id === message.id ? message : item)
    : [...messages, message];

  return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function useGroupMessageRealtime(groupId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!groupId) return;

    let mounted = true;
    let cleanup: (() => void) | null = null;

    getSocket().then((socket) => {
      if (!mounted) return;

      const joinRoom = () => socket.emit('joinGroupRoom', groupId);
      const messageKey = GROUP_KEYS.messages(groupId);

      const onMessageCreated = (message: GroupMessage) => {
        if (!mounted || message.group_id !== groupId) return;
        queryClient.setQueryData<GroupMessage[]>(messageKey, (old = []) => upsertGroupMessage(old, message));
      };

      const onMessageUpdated = (message: GroupMessage) => {
        if (!mounted || message.group_id !== groupId) return;
        queryClient.setQueryData<GroupMessage[]>(messageKey, (old = []) => upsertGroupMessage(old, message));
      };

      const onMessageDeleted = (payload: string | { groupId?: string; messageId?: string }) => {
        const messageId = typeof payload === 'string' ? payload : payload.messageId;
        const payloadGroupId = typeof payload === 'string' ? groupId : payload.groupId;
        if (!mounted || !messageId || payloadGroupId !== groupId) return;
        queryClient.setQueryData<GroupMessage[]>(messageKey, (old = []) =>
          old.filter((message) => message.id !== messageId),
        );
      };

      joinRoom();
      socket.on('connect', joinRoom);
      socket.on('newGroupMessage', onMessageCreated);
      socket.on('groupMessageUpdated', onMessageUpdated);
      socket.on('groupMessageDeleted', onMessageDeleted);

      cleanup = () => {
        socket.off('connect', joinRoom);
        socket.off('newGroupMessage', onMessageCreated);
        socket.off('groupMessageUpdated', onMessageUpdated);
        socket.off('groupMessageDeleted', onMessageDeleted);
        socket.emit('leaveGroupRoom', groupId);
      };
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [groupId, queryClient]);
}

export function useGroupsRealtime(channelId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!channelId) return;

    let mounted = true;
    let cleanup: (() => void) | null = null;

    getSocket().then((socket) => {
      if (!mounted) return;

      const joinRoom = () => socket.emit('joinChannelRoom', channelId);
      const groupsKey = GROUP_KEYS.byChannel(channelId);

      const onGroupCreated = () => {
        if (!mounted) return;
        queryClient.invalidateQueries({ queryKey: groupsKey });
      };

      const onGroupUpdated = (payload: { groupId?: string }) => {
        if (!mounted) return;
        queryClient.invalidateQueries({ queryKey: groupsKey });
        if (payload?.groupId) {
          queryClient.invalidateQueries({ queryKey: GROUP_KEYS.members(payload.groupId) });
        }
      };

      const onGroupDeleted = () => {
        if (!mounted) return;
        queryClient.invalidateQueries({ queryKey: groupsKey });
      };

      joinRoom();
      socket.on('connect', joinRoom);
      socket.on('groupCreated', onGroupCreated);
      socket.on('groupUpdated', onGroupUpdated);
      socket.on('groupDeleted', onGroupDeleted);

      cleanup = () => {
        socket.off('connect', joinRoom);
        socket.off('groupCreated', onGroupCreated);
        socket.off('groupUpdated', onGroupUpdated);
        socket.off('groupDeleted', onGroupDeleted);
        socket.emit('leaveChannelRoom', channelId);
      };
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [channelId, queryClient]);
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

export function useUpdateGroup(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: { name?: string; description?: string; group_type?: 'text' | 'voice' | 'watch'; access_type?: 'PUBLIC' | 'PRIVATE' } }) =>
      groupsApi.updateGroup(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.byChannel(channelId) });
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

export function useGroupJoinRequests(groupId: string | undefined) {
  return useQuery({
    queryKey: GROUP_KEYS.joinRequests(groupId ?? ''),
    queryFn: () => groupsApi.getGroupJoinRequests(groupId!),
    enabled: !!groupId,
  });
}

export function useRequestJoinGroup() {
  return useMutation({
    mutationFn: (groupId: string) => groupsApi.requestJoinGroup(groupId),
  });
}

export function useRespondToGroupJoinRequest(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: 'ACCEPTED' | 'REJECTED' }) =>
      groupsApi.respondToJoinRequest(groupId, requestId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.joinRequests(groupId) });
      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.members(groupId) });
    },
  });
}

export function backendGroupToMock(group: BackendGroup) {
  return {
    id: group.id,
    label: group.name,
    description: group.description ?? '',
    kind: (group.group_type ?? 'text') as 'text' | 'voice' | 'watch',
    access_type: (group.access_type ?? 'PUBLIC') as 'PUBLIC' | 'PRIVATE',
    is_general: group.is_general,
    is_member: group.is_member ?? false,
    membersLabel: '',
    pinnedBy: '',
    pinnedMessage: '',
  };
}
