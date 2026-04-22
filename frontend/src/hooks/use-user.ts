'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type FollowerRecord,
  type FollowingRecord,
  type UserPost,
  type UserProfile,
  type UserSearchResult,
  userApi,
} from '@/lib/user-api';

export const USER_KEYS = {
  profile: ['user', 'profile'] as const,
  byId: (id: string) => ['user', 'by-id', id] as const,
  settings: ['user', 'settings'] as const,
  followers: (userId: string) => ['user', userId, 'followers'] as const,
  following: (userId: string) => ['user', userId, 'following'] as const,
  posts: (userId: string) => ['user', userId, 'posts'] as const,
  search: (q: string) => ['user', 'search', q] as const,
};

export function useProfile() {
  return useQuery<UserProfile>({
    queryKey: USER_KEYS.profile,
    queryFn: userApi.getProfile,
  });
}

export function useUserById(id?: string) {
  return useQuery<UserProfile>({
    queryKey: id ? USER_KEYS.byId(id) : ['user', 'by-id', 'missing'],
    queryFn: () => userApi.getUserById(id!),
    enabled: Boolean(id),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userApi.updateProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(USER_KEYS.profile, updated);
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: USER_KEYS.settings,
    queryFn: userApi.getSettings,
  });
}

export function useUserFollowers(userId?: string) {
  return useQuery<FollowerRecord[]>({
    queryKey: userId ? USER_KEYS.followers(userId) : ['user', 'followers', 'missing'],
    queryFn: () => userApi.getFollowers(userId!),
    enabled: Boolean(userId),
  });
}

export function useUserFollowing(userId?: string) {
  return useQuery<FollowingRecord[]>({
    queryKey: userId ? USER_KEYS.following(userId) : ['user', 'following', 'missing'],
    queryFn: () => userApi.getFollowing(userId!),
    enabled: Boolean(userId),
  });
}

export function useUserPosts(userId?: string) {
  return useQuery<UserPost[]>({
    queryKey: userId ? USER_KEYS.posts(userId) : ['user', 'posts', 'missing'],
    queryFn: () => userApi.getUserPosts(userId!),
    enabled: Boolean(userId),
  });
}

export function useSearchUsers(query: string) {
  return useQuery<UserSearchResult[]>({
    queryKey: USER_KEYS.search(query),
    queryFn: () => userApi.searchUsers(query),
    enabled: query.trim().length > 0,
  });
}

export function useSendFollowRequest() {
  return useMutation({
    mutationFn: (userId: string) => userApi.sendFollowRequest(userId),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userApi.updateSettings,
    onMutate: (variables) => {
      const previous = queryClient.getQueryData(USER_KEYS.settings);
      queryClient.setQueryData(USER_KEYS.settings, (old: Record<string, unknown>) => ({
        ...old,
        ...variables,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(USER_KEYS.settings, context?.previous);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(USER_KEYS.settings, updated);
    },
  });
}
