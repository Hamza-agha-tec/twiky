import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { storiesApi, type FeedGroup } from '@/lib/stories-api';

export const STORY_KEYS = {
  feed: ['stories', 'feed'] as const,
};

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
    mutationFn: async ({ file, caption }: { file: File; caption: string }) => {
      const { publicUrl, type } = await storiesApi.uploadMedia(file);
      return storiesApi.createStory({ media_url: publicUrl, type, caption: caption || undefined });
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
  return useMutation({
    mutationFn: (storyId: string) => storiesApi.recordView(storyId),
  });
}
