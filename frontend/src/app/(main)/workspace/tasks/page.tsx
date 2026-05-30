'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collaborationApi } from '@/lib/collaboration-api';
import { ListChecks, LayoutGrid, List, Plus, Search, X, Users, Kanban } from 'lucide-react';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnimatePresence, motion } from 'framer-motion';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

// Import your existing components
import TaskCard from '@/components/tasks/TaskCard';
import TaskForm from '@/components/tasks/TaskForm';
import KanbanBoard from '@/components/tasks/KanbanBoard';
import TaskDetailView from '@/components/tasks/TaskDetailView';

export default function WorkspaceTasks() {
  const queryClient = useQueryClient();
  const [view, setView] = useState('kanban');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [deleteTask, setDeleteTask] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [focusedTask, setFocusedTask] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  useKeyboardShortcut('Delete', () => {
    if (focusedTask) setDeleteTask(focusedTask);
  });

  const { user, loading: isUserLoading } = useAuth();

  const { data: tasksData = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => collaborationApi.tasks.list(''), // Fetch all for user
    enabled: !!user && !isUserLoading,
  });

  const tasks = Array.isArray(tasksData) ? tasksData : (tasksData as any)?.tasks || (tasksData as any)?.data || [];

  const isLoading = isUserLoading || isTasksLoading;

  const createMutation = useMutation({
    mutationFn: (data: any) => collaborationApi.tasks.create({ ...data, project_id: '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => collaborationApi.tasks.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditingTask(null);
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => collaborationApi.tasks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setDeleteTask(null);
    },
  });

  const handleSubmit = async (data: any) => {
    const { subtasks, ...taskData } = data;
    let taskId: string;

    try {
      if (editingTask) {
        taskId = editingTask.id;
        await updateMutation.mutateAsync({ id: taskId, data: taskData });
      } else {
        const res = await createMutation.mutateAsync(taskData);
        // Handle both possible response structures
        const typedRes = res as Record<string, any>;
        taskId = typedRes?.data?.id || typedRes?.id;
      }

      if (taskId && subtasks?.length > 0) {
        const promises = subtasks.map((sub: any) => {
          if (sub.id) {
            return collaborationApi.tasks.updateSubtask(sub.id, {
              title: sub.title,
              is_completed: sub.is_completed,
            });
          } else {
            return collaborationApi.tasks.createSubtask({
              ...sub,
              task_id: taskId,
            });
          }
        });
        await Promise.all(promises);
      }

      // Cleanup and close
      setShowForm(false);
      setEditingTask(null);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  };

  const handleStatusChange = async (task: any, status: string, extraData?: any) => {
    if (status === 'update_subtask') {
      const { subId, is_completed } = extraData;
      await collaborationApi.tasks.updateSubtask(subId, { is_completed });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks', task.id] });
      return;
    }

    if (status === 'DONE') {
      // playSuccessSound(); // Add if needed
    }
    updateMutation.mutate({ id: task.id, data: { status } });
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId;

    if (newStatus === 'DONE') {
      // playSuccessSound(); // Add if needed
    }

    updateMutation.mutate({ id: taskId, data: { status: newStatus } });
  };

  const filteredTasks = tasks.filter((task: any) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search ||
      task.title?.toLowerCase().includes(searchLower) ||
      task.description?.toLowerCase().includes(searchLower);

    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesScope = scopeFilter === 'all' ||
      (scopeFilter === 'personal' && !task.team_id) ||
      (scopeFilter === 'team' && task.team_id);

    return matchesSearch && matchesPriority && matchesStatus && matchesScope;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <ListChecks className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Tasks</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                {tasks.length} tasks to organize your work
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowForm(true)}
            className="h-11 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] gap-2"
          >
            <Plus className="w-5 h-5" /> New Task
          </Button>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center gap-3 mb-10"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus-visible:ring-slate-400 font-medium text-sm shadow-sm"
            />
          </div>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px] h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="TODO">To Do</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-11 px-1.5">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                view === 'kanban' ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
              title="Kanban View"
            >
              <Kanban className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                view === 'list' ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {search && (
            <Button variant="ghost" size="icon" onClick={() => setSearch('')} className="h-11 w-11 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-5 h-5" />
            </Button>
          )}
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : filteredTasks.length > 0 ? (
          <AnimatePresence mode="wait">
            {view === 'kanban' ? (
              <motion.div
                key="kanban"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <KanbanBoard
                  tasks={filteredTasks}
                  user={user}
                  onDragEnd={handleDragEnd}
                  onEdit={(task: any) => { setEditingTask(task); setShowForm(true); }}
                  onDelete={setDeleteTask}
                  onStatusChange={(taskId: string, status: string) => handleStatusChange({ id: taskId }, status)}
                  onOpenDetail={setSelectedTask}
                  onCreateNew={() => setShowForm(true)}
                  onMouseEnterCard={setFocusedTask}
                  onMouseLeaveCard={() => setFocusedTask(null)}
                  focusedTaskId={focusedTask?.id}
                />
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {filteredTasks.map((task: any) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    user={user}
                    onEdit={(t: any) => { setEditingTask(t); setShowForm(true); }}
                    onDelete={setDeleteTask}
                    onStatusChange={(taskId: string, status: string) => handleStatusChange({ id: taskId }, status)}
                    onOpenDetail={setSelectedTask}
                    isDragging={false}
                    onMouseEnter={() => setFocusedTask(task)}
                    onMouseLeave={() => setFocusedTask(null)}
                    isFocused={focusedTask?.id === task.id}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
              <ListChecks className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No tasks yet</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
              Create your first task to start organizing your work and tracking progress.
            </p>
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Create Task
            </Button>
          </motion.div>
        )}
      </div>

      {/* Task Form */}
      <TaskForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingTask(null);
        }}
        onSubmit={handleSubmit}
        task={editingTask}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Task Detail View */}
      <TaskDetailView
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onEdit={(task: any) => {
          setSelectedTask(null);
          setEditingTask(task);
          setShowForm(true);
        }}
        onDelete={(task: any) => {
          setSelectedTask(null);
          setDeleteTask(task);
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTask}
        onOpenChange={() => setDeleteTask(null)}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        onConfirm={() => deleteTask && deleteMutation.mutate(deleteTask.id)}
      />
    </div>
  );
}
