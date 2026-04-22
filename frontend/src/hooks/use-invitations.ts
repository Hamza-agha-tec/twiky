'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Invitation, invitationsApi } from '@/lib/invitations-api';

export const INVITATION_KEYS = {
  pending: ['invitations', 'pending'] as const,
};

export function usePendingInvitations() {
  return useQuery<Invitation[]>({
    queryKey: INVITATION_KEYS.pending,
    queryFn: invitationsApi.getPending,
    refetchInterval: 15000,
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
