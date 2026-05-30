'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '@/lib/project-api';

export function useChannelProjects(channelId: string | undefined) {
  return useQuery({
    queryKey: ['projects', channelId],
    queryFn: () => projectApi.list(channelId!),
    enabled: !!channelId,
  });
}

export function useProject(channelId: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', channelId, projectId],
    queryFn: () => projectApi.get(channelId!, projectId!),
    enabled: !!channelId && !!projectId,
  });
}

export function useProjectGroups(channelId: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-groups', channelId, projectId],
    queryFn: () => projectApi.listGroups(channelId!, projectId!),
    enabled: !!channelId && !!projectId,
  });
}

export function useCreateProject(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; access_type?: 'PUBLIC' | 'PRIVATE' }) =>
      projectApi.create(channelId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', channelId] }),
  });
}

export function useUpdateProject(channelId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; description?: string; access_type?: 'PUBLIC' | 'PRIVATE' }) =>
      projectApi.update(channelId, projectId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', channelId] });
      qc.invalidateQueries({ queryKey: ['projects', channelId, projectId] });
    },
  });
}

export function useDeleteProject(channelId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => projectApi.delete(channelId, projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', channelId] }),
  });
}

export function useProjectJoinRequests(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-join-requests', projectId],
    queryFn: () => projectApi.listJoinRequests(projectId!),
    enabled: !!projectId,
  });
}

export function useRespondToProjectJoinRequest(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: 'ACCEPT' | 'REJECT' }) =>
      projectApi.respondToJoinRequest(requestId, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-join-requests', projectId] });
      qc.invalidateQueries({ queryKey: ['project-members', projectId] });
    },
  });
}

export function useRequestJoinProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projectApi.requestJoin(projectId),
    onSuccess: (_, projectId) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useJoinProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projectApi.join(projectId),
    onSuccess: (_, projectId) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectApi.listMembers(projectId!),
    enabled: !!projectId,
  });
}

export function useProjectWhiteboards(channelId: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ['whiteboards', channelId, projectId],
    queryFn: () => projectApi.listWhiteboards(channelId!, projectId!),
    enabled: !!channelId && !!projectId,
  });
}
