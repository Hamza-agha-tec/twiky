'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { voiceApi, type VoiceRoom } from '../lib/voice-api';

export const VOICE_ROOM_KEYS = {
  all: ['voice-rooms'] as const,
  user: () => [...VOICE_ROOM_KEYS.all, 'user'] as const,
  room: (roomId: string) => [...VOICE_ROOM_KEYS.all, 'room', roomId] as const,
};

export function useUserVoiceRooms() {
  return useQuery({
    queryKey: VOICE_ROOM_KEYS.user(),
    queryFn: () => voiceApi.getUserVoiceRooms(),
    staleTime: 30_000,
  });
}

export function useVoiceRoom(roomId: string | undefined) {
  return useQuery({
    queryKey: VOICE_ROOM_KEYS.room(roomId ?? ''),
    queryFn: () => voiceApi.getVoiceRoom(roomId!),
    enabled: !!roomId,
    staleTime: 30_000,
  });
}

export function useCreateVoiceRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: voiceApi.createVoiceRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VOICE_ROOM_KEYS.user() });
    },
  });
}

export function useValidateRoomAccess() {
  return useMutation({
    mutationFn: voiceApi.validateRoomAccess,
  });
}
