'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { githubApi } from '@/lib/github-api'

export const GITHUB_KEYS = {
  status: (userId: string) => ['github', 'status', userId] as const,
  profile: (userId: string) => ['github', 'profile', userId] as const,
  activity: (userId: string) => ['github', 'activity', userId] as const,
}

export function useGitHubStatus(userId: string | undefined) {
  return useQuery({
    queryKey: GITHUB_KEYS.status(userId ?? ''),
    queryFn: () => githubApi.getStatus(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useGitHubProfile(userId: string | undefined) {
  return useQuery({
    queryKey: GITHUB_KEYS.profile(userId ?? ''),
    queryFn: () => githubApi.getProfile(userId!),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
}

export function useGitHubActivity(userId: string | undefined) {
  return useQuery({
    queryKey: GITHUB_KEYS.activity(userId ?? ''),
    queryFn: () => githubApi.getActivity(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useGitHubAuthUrl() {
  return useMutation({
    mutationFn: () => githubApi.getAuthUrl(),
  })
}

export function useGitHubDisconnect(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => githubApi.disconnect(),
    onSuccess: () => {
      if (userId) {
        queryClient.removeQueries({ queryKey: GITHUB_KEYS.status(userId) })
        queryClient.removeQueries({ queryKey: GITHUB_KEYS.profile(userId) })
        queryClient.removeQueries({ queryKey: GITHUB_KEYS.activity(userId) })
      }
      queryClient.invalidateQueries({ queryKey: ['github'] })
    },
  })
}

export function useGitHubConnect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => githubApi.connect(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['github'] }),
  })
}
