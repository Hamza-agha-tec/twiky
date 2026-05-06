import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { storiesApi, searchMusicTracks, type FeedGroup, type SpotifyTrack } from '@/lib/stories-api';
import { getSocket } from '@/lib/socket';

export const STORY_KEYS = {
  feed: ['stories', 'feed'] as const,
  spotifySearch: (q: string) => ['stories', 'spotify-search', q] as const,
};

const SEEN_KEY = 'twiky-seen-stories';

export function getSeenStoryIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function markStorySeen(storyId: string) {
  try {
    const ids = getSeenStoryIds();
    ids.add(storyId);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function useStoriesFeed() {
  return useQuery<FeedGroup[]>({
    queryKey: STORY_KEYS.feed,
    queryFn: () => storiesApi.getFeed(),
    staleTime: 30_000,
  });
}

export function useCreateStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      caption,
      music,
    }: {
      file: File;
      caption: string;
      music?: SpotifyTrack | null;
    }) => {
      const { publicUrl, type } = await storiesApi.uploadMedia(file);
      return storiesApi.createStory({
        media_url: publicUrl,
        type,
        caption: caption || undefined,
        music_preview_url: music?.preview_url ?? undefined,
        music_title: music?.title ?? undefined,
        music_artist: music?.artist ?? undefined,
        music_cover_url: music?.cover_url ?? undefined,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: STORY_KEYS.feed }),
  });
}

export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) => storiesApi.deleteStory(storyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: STORY_KEYS.feed }),
  });
}

export function useRecordView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) => {
      markStorySeen(storyId);
      return storiesApi.recordView(storyId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: STORY_KEYS.feed }),
  });
}

export function useStoryViewEvents() {
  const qc = useQueryClient();
  useEffect(() => {
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null;
    getSocket().then((s) => {
      socket = s;
      s.on('storyViewed', ({ storyId, viewsCount }: { storyId: string; viewsCount: number }) => {
        qc.setQueryData<FeedGroup[]>(STORY_KEYS.feed, (old) => {
          if (!old) return old;
          return old.map((g) => ({
            ...g,
            stories: g.stories.map((s) =>
              s.id === storyId
                ? { ...s, views_count: [{ count: viewsCount }] }
                : s
            ),
          }));
        });
      });
    });
    return () => { socket?.off('storyViewed'); };
  }, [qc]);
}

export function useSpotifySearch(query: string) {
  return useQuery<SpotifyTrack[]>({
    queryKey: STORY_KEYS.spotifySearch(query),
    queryFn: () => searchMusicTracks(query),
    enabled: query.trim().length >= 2,
    staleTime: 60_000,
  });
}
