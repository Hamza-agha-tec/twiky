'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { spotifyApi, type SpotifyNowPlaying } from '@/lib/spotify-api';
import { getSocket } from '@/lib/socket';

export const SPOTIFY_KEYS = {
  nowPlaying: (userId: string) => ['spotify', 'now-playing', userId] as const,
  profile: (userId: string) => ['spotify', 'profile', userId] as const,
};

export function useSpotifyNowPlaying(userId: string | undefined) {
  const queryClient = useQueryClient();
  const [socketData, setSocketData] = useState<SpotifyNowPlaying | undefined>(undefined);
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    const onNowPlaying = (payload: SpotifyNowPlaying & { userId: string }) => {
      if (!mounted || payload.userId !== userId) return;
      const { userId: _uid, ...rest } = payload as any;
      setSocketData(rest);
      queryClient.setQueryData(SPOTIFY_KEYS.nowPlaying(userId), rest);
    };

    const onReconnect = () => {
      if (mounted) socketRef.current?.emit('subscribeSpotifyStatus', userId);
    };

    getSocket().then((socket) => {
      if (!mounted) return;
      socketRef.current = socket;
      socket.on('spotifyNowPlaying', onNowPlaying);
      socket.on('connect', onReconnect);
      socket.emit('subscribeSpotifyStatus', userId);
    });

    return () => {
      mounted = false;
      const socket = socketRef.current;
      if (socket) {
        socket.off('spotifyNowPlaying', onNowPlaying);
        socket.off('connect', onReconnect);
        socket.emit('unsubscribeSpotifyStatus', userId);
      }
    };
  }, [userId, queryClient]);

  // One-shot REST fetch for instant display on mount — socket pushes all updates after
  const restQuery = useQuery({
    queryKey: SPOTIFY_KEYS.nowPlaying(userId ?? ''),
    queryFn: () => spotifyApi.getNowPlaying(userId!),
    enabled: !!userId,
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const data = socketData ?? restQuery.data;

  return { data, isLoading: restQuery.isLoading && !socketData };
}

export function useSpotifyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: SPOTIFY_KEYS.profile(userId ?? ''),
    queryFn: () => spotifyApi.getProfile(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSpotifyConnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => spotifyApi.connect(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spotify'] }),
  });
}

export function useSpotifyAuthUrl() {
  return useMutation({
    mutationFn: () => spotifyApi.getAuthUrl(),
  });
}

export function useSpotifyDisconnect(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => spotifyApi.disconnect(),
    onSuccess: () => {
      if (userId) {
        queryClient.setQueryData(SPOTIFY_KEYS.nowPlaying(userId), {
          is_playing: false,
          message: 'Spotify not connected',
        });
        queryClient.removeQueries({ queryKey: SPOTIFY_KEYS.profile(userId) });
      }
      queryClient.invalidateQueries({ queryKey: ['spotify'] });
    },
  });
}
