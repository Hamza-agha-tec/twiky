'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApi, type BoardPost, type BoardComment } from '@/lib/boards-api';
import { getSocket } from '@/lib/socket';

export const BOARD_KEYS = {
  tags: (groupId: string) => ['boards', groupId, 'tags'] as const,
  posts: (groupId: string) => ['boards', groupId, 'posts'] as const,
  post: (postId: string) => ['boards', 'post', postId] as const,
  comments: (postId: string) => ['boards', 'comments', postId] as const,
};

// ─── Tags ─────────────────────────────────────────────────────────────────────

export function useBoardTags(groupId: string | undefined) {
  return useQuery({
    queryKey: BOARD_KEYS.tags(groupId ?? ''),
    queryFn: () => boardsApi.getTags(groupId!),
    enabled: !!groupId,
    staleTime: 60_000,
  });
}

export function useCreateBoardTag(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) => boardsApi.createTag(groupId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARD_KEYS.tags(groupId) }),
  });
}

export function useDeleteBoardTag(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => boardsApi.deleteTag(groupId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARD_KEYS.tags(groupId) }),
  });
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export function useBoardPosts(groupId: string | undefined) {
  return useQuery({
    queryKey: BOARD_KEYS.posts(groupId ?? ''),
    queryFn: () => boardsApi.getPosts(groupId!),
    enabled: !!groupId,
    staleTime: 15_000,
  });
}

export function useBoardPost(postId: string | undefined) {
  return useQuery({
    queryKey: BOARD_KEYS.post(postId ?? ''),
    queryFn: () => boardsApi.getPost(postId!),
    enabled: !!postId,
  });
}

export function useCreateBoardPost(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; content?: string; media_urls?: string[]; tag_ids?: string[] }) =>
      boardsApi.createPost(groupId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARD_KEYS.posts(groupId) }),
  });
}

export function useUpdateBoardPost(postId: string, groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string; content?: string; is_pinned?: boolean; is_locked?: boolean }) =>
      boardsApi.updatePost(postId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOARD_KEYS.posts(groupId) });
      qc.invalidateQueries({ queryKey: BOARD_KEYS.post(postId) });
    },
  });
}

export function useDeleteBoardPost(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => boardsApi.deletePost(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARD_KEYS.posts(groupId) }),
  });
}

export function useLikeBoardPost(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      liked ? boardsApi.unlikePost(postId) : boardsApi.likePost(postId),
    onMutate: async ({ postId, liked }) => {
      await qc.cancelQueries({ queryKey: BOARD_KEYS.posts(groupId) });
      const prev = qc.getQueryData<BoardPost[]>(BOARD_KEYS.posts(groupId));
      qc.setQueryData<BoardPost[]>(BOARD_KEYS.posts(groupId), (old) =>
        (old ?? []).map((p) =>
          p.id === postId
            ? { ...p, is_liked: !liked, like_count: p.like_count + (liked ? -1 : 1) }
            : p,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(BOARD_KEYS.posts(groupId), ctx.prev);
    },
  });
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export function useBoardComments(postId: string | undefined) {
  return useQuery({
    queryKey: BOARD_KEYS.comments(postId ?? ''),
    queryFn: () => boardsApi.getComments(postId!),
    enabled: !!postId,
  });
}

export function useAddBoardComment(postId: string, groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { content: string; media_urls?: string[]; parent_comment_id?: string | null }) =>
      boardsApi.addComment(postId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOARD_KEYS.comments(postId) });
      qc.invalidateQueries({ queryKey: BOARD_KEYS.posts(groupId) });
    },
  });
}

export function useDeleteBoardComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => boardsApi.deleteComment(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARD_KEYS.comments(postId) }),
  });
}

// ─── Real-time ────────────────────────────────────────────────────────────────

export function useBoardRealtime(groupId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!groupId) return;
    let cleanup: (() => void) | null = null;

    getSocket().then((socket) => {
      const joinRoom = () => socket.emit('joinGroupRoom', groupId);
      joinRoom();
      socket.on('connect', joinRoom);

      const onNewPost = (payload: { groupId: string; post: BoardPost }) => {
        if (payload.groupId !== groupId) return;
        qc.setQueryData<BoardPost[]>(BOARD_KEYS.posts(groupId), (old) => {
          if (!old) return [payload.post];
          if (old.some((p) => p.id === payload.post.id)) return old;
          return [payload.post, ...old];
        });
      };

      const onPostUpdated = (payload: { groupId: string; post: BoardPost }) => {
        if (payload.groupId !== groupId) return;
        qc.setQueryData<BoardPost[]>(BOARD_KEYS.posts(groupId), (old) =>
          (old ?? []).map((p) => (p.id === payload.post.id ? payload.post : p)),
        );
        qc.setQueryData(BOARD_KEYS.post(payload.post.id), payload.post);
      };

      const onPostDeleted = (payload: { groupId: string; postId: string }) => {
        if (payload.groupId !== groupId) return;
        qc.setQueryData<BoardPost[]>(BOARD_KEYS.posts(groupId), (old) =>
          (old ?? []).filter((p) => p.id !== payload.postId),
        );
      };

      const onLikeUpdate = (payload: { groupId: string; postId: string; likeCount: number }) => {
        if (payload.groupId !== groupId) return;
        qc.setQueryData<BoardPost[]>(BOARD_KEYS.posts(groupId), (old) =>
          (old ?? []).map((p) =>
            p.id === payload.postId ? { ...p, like_count: payload.likeCount } : p,
          ),
        );
      };

      const onNewComment = (payload: { groupId: string; postId: string; comment: BoardComment }) => {
        if (payload.groupId !== groupId) return;
        qc.invalidateQueries({ queryKey: BOARD_KEYS.comments(payload.postId) });
        qc.setQueryData<BoardPost[]>(BOARD_KEYS.posts(groupId), (old) =>
          (old ?? []).map((p) =>
            p.id === payload.postId ? { ...p, comment_count: p.comment_count + 1 } : p,
          ),
        );
      };

      socket.on('board:new_post', onNewPost);
      socket.on('board:post_updated', onPostUpdated);
      socket.on('board:post_deleted', onPostDeleted);
      socket.on('board:like_update', onLikeUpdate);
      socket.on('board:new_comment', onNewComment);

      cleanup = () => {
        socket.off('connect', joinRoom);
        socket.off('board:new_post', onNewPost);
        socket.off('board:post_updated', onPostUpdated);
        socket.off('board:post_deleted', onPostDeleted);
        socket.off('board:like_update', onLikeUpdate);
        socket.off('board:new_comment', onNewComment);
      };
    });

    return () => { cleanup?.(); };
  }, [groupId, qc]);
}
