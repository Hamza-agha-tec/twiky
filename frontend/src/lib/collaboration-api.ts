import { createClient } from '../utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function authedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export interface ProjectNote {
  id: string;
  project_id?: string | null;
  group_id?: string | null;
  author_id: string;
  title: string;
  content?: string | null;
  created_at: string;
  tags?: string[];
  color?: string | null;
  is_pinned?: boolean;
}

export interface ProjectTask {
  id: string;
  project_id?: string | null;
  group_id?: string | null;
  creator_id: string;
  assignee_id?: string | null;
  title: string;
  description?: string | null;
  status: string;
  priority?: string;
  due_date?: string | null;
  created_at: string;
  tags?: string[];
}

export interface ProjectGoal {
  id: string;
  project_id?: string | null;
  group_id?: string | null;
  user_id?: string | null;
  title: string;
  description?: string | null;
  category?: string;
  status?: string;
  priority?: string;
  progress?: number;
  target_date?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ProjectWhiteboard {
  id: string;
  project_id?: string | null;
  created_by: string;
  title: string;
  data: any;
  created_at: string;
  updated_at: string;
}

export const collaborationApi = {
  notes: {
    list: (projectId: string) =>
      authedFetch<ProjectNote[]>(`/notes?project_id=${encodeURIComponent(projectId)}`),
    create: (body: { title: string; content?: string; project_id: string; color?: string }) =>
      authedFetch<ProjectNote>('/notes', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { title?: string; content?: string; color?: string; is_pinned?: boolean }) =>
      authedFetch<ProjectNote>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) =>
      authedFetch<{ message: string }>(`/notes/${id}`, { method: 'DELETE' }),
  },
  tasks: {
    list: (projectId: string) =>
      authedFetch<ProjectTask[]>(`/tasks?project_id=${encodeURIComponent(projectId)}`),
    create: (body: {
      title: string;
      description?: string;
      project_id: string;
      priority?: string;
      status?: string;
    }) => authedFetch<ProjectTask>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<ProjectTask>) =>
      authedFetch<ProjectTask>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) =>
      authedFetch<{ message: string }>(`/tasks/${id}`, { method: 'DELETE' }),
    createSubtask: (body: { title: string; task_id: string; is_completed?: boolean }) =>
      authedFetch<any>('/subtasks', { method: 'POST', body: JSON.stringify(body) }),
    updateSubtask: (id: string, body: { title?: string; is_completed?: boolean }) =>
      authedFetch<any>(`/subtasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    getSubtasks: (taskId: string) =>
      authedFetch<any[]>(`/subtasks?task_id=${encodeURIComponent(taskId)}`),
  },
  taskComments: {
    list: (taskId: string) =>
      authedFetch<any[]>(`/task-comments?task_id=${encodeURIComponent(taskId)}`),
    create: (body: { task_id: string; content: string; parent_id?: string }) =>
      authedFetch<any>('/task-comments', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { content?: string; reactions?: any[] }) =>
      authedFetch<any>(`/task-comments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) =>
      authedFetch<{ message: string }>(`/task-comments/${id}`, { method: 'DELETE' }),
  },
  goals: {
    list: (projectId?: string) => {
      const path = projectId ? `/goals?project_id=${encodeURIComponent(projectId)}` : '/goals';
      return authedFetch<ProjectGoal[]>(path);
    },
    create: (body: {
      title: string;
      description?: string;
      project_id: string;
      category?: string;
      priority?: string;
    }) => authedFetch<ProjectGoal>('/goals', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<ProjectGoal>) =>
      authedFetch<ProjectGoal>(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) =>
      authedFetch<{ message: string }>(`/goals/${id}`, { method: 'DELETE' }),
    getNotes: (goalId: string) =>
      authedFetch<any[]>(`/goals/${goalId}/notes`),
    createNote: (goalId: string, body: { content: string }) =>
      authedFetch<any>(`/goals/${goalId}/notes`, { method: 'POST', body: JSON.stringify(body) }),
    deleteNote: (goalId: string, noteId: string) =>
      authedFetch<{ message: string }>(`/goals/${goalId}/notes/${noteId}`, { method: 'DELETE' }),
  },
  whiteboards: {
    list: (projectId: string) =>
      authedFetch<ProjectWhiteboard[]>(`/whiteboards?project_id=${encodeURIComponent(projectId)}`),
    get: (id: string) =>
      authedFetch<ProjectWhiteboard>(`/whiteboards/${id}`),
    create: (body: { title: string; project_id: string; data: any }) =>
      authedFetch<ProjectWhiteboard>('/whiteboards', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { title?: string; data?: any; project_id?: string }) => {
      const path = body.project_id ? `/whiteboards/${id}?project_id=${encodeURIComponent(body.project_id)}` : `/whiteboards/${id}`;
      return authedFetch<ProjectWhiteboard>(path, { method: 'PATCH', body: JSON.stringify(body) });
    },
    delete: (id: string) =>
      authedFetch<{ message: string }>(`/whiteboards/${id}`, { method: 'DELETE' }),
  },
};
