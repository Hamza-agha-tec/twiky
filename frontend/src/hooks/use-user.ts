'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { userApi } from '@/lib/user-api';

export const USER_KEYS = {
  profile: ['user', 'profile'] as const,
  settings: ['user', 'settings'] as const,
  contacts: ['user', 'contacts'] as const,
};

export interface Contact {
  id: string;
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  is_blocked: boolean;
  is_archived: boolean;
  is_favorite: boolean;
  is_pinned: boolean;
  is_muted: boolean;
}

export function useProfile() {
  return useQuery({
    queryKey: USER_KEYS.profile,
    queryFn: userApi.getProfile,
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

export function useContacts() {
  return useQuery<Contact[]>({
    queryKey: USER_KEYS.contacts,
    queryFn: userApi.getContacts,
  });
}

export function useAddContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userApi.addContact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USER_KEYS.contacts }),
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userApi.updateContact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USER_KEYS.contacts }),
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userApi.deleteContact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USER_KEYS.contacts }),
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
