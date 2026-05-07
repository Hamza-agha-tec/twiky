'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Invitation, invitationsApi } from '@/lib/invitations-api';
import { getSocket } from '@/lib/socket';

export const INVITATION_KEYS = {
  pending: ['invitations', 'pending'] as const,
};

export function usePendingInvitations() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;

    getSocket().then((socket) => {
      if (!mounted) return;
      const handler = (notification: { type: string }) => {
        if (notification.type === 'INVITATION') {
          queryClient.invalidateQueries({ queryKey: INVITATION_KEYS.pending });
        }
      };
      socket.on('newNotification', handler);
      cleanup = () => socket.off('newNotification', handler);
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [queryClient]);

  return useQuery<Invitation[]>({
    queryKey: INVITATION_KEYS.pending,
    queryFn: invitationsApi.getPending,
  });
}

export function useRespondToInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invitationId, status }: { invitationId: string; status: 'ACCEPTED' | 'REJECTED' }) =>
      invitationsApi.respond(invitationId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVITATION_KEYS.pending });
    },
  });
}

export function useSendGroupInvitation() {
  return useMutation({
    mutationFn: ({ inviteeId, groupId }: { inviteeId: string; groupId: string }) =>
      invitationsApi.send(inviteeId, 'GROUP', groupId),
  });
}
