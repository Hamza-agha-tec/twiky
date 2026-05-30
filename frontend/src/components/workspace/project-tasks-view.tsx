'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListChecks, List, Plus, Search, X, Kanban } from 'lucide-react';
import { collaborationApi } from '@/lib/collaboration-api';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useSound } from '@/hooks/useSound';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnimatePresence, motion } from 'framer-motion';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import TaskCard from '@/components/tasks/TaskCard';
import TaskForm from '@/components/tasks/TaskForm';
import KanbanBoard from '@/components/tasks/KanbanBoard';
import TaskDetailView from '@/components/tasks/TaskDetailView';
import { toast } from 'sonner';

export function ProjectTasksView({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState('kanban');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [deleteTask, setDeleteTask] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [focusedTask, setFocusedTask] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  useKeyboardShortcut('Delete', () => {
    if (focusedTask) {
      setDeleteTask(focusedTask);
    }
  });

  const { user, loading: isUserLoading } = useAuth();

  const { data: tasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: () => collaborationApi.tasks.list(projectId),
  });

  const isLoading = isUserLoading || isTasksLoading;

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      collaborationApi.tasks.create({
        ...data,
        project_id: projectId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      setShowForm(false);
    },
    onError: (err: any) => {
      console.error('Failed to create task:', err);
      toast.error(err.message || 'Failed to create task');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => collaborationApi.tasks.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      setEditingTask(null);
      setShowForm(false);
    },
    onError: (err: any) => {
      console.error('Failed to update task:', err);
      toast.error(err.message || 'Failed to update task');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => collaborationApi.tasks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      setDeleteTask(null);
    },
    onError: (err: any) => {
      console.error('Failed to delete task:', err);
      toast.error(err.message || 'Failed to delete task');
    }
  });

  const handleSubmit = async (data: any) => {
    const { subtasks, ...taskData } = data;
    let taskId;

    // Filter out objects and empty strings for relation fields
    const cleanTaskData = { ...taskData };
    const idFields = ['project_id', 'creator_id', 'assignee_id', 'group_id'];

    idFields.forEach(field => {
      if (typeof cleanTaskData[field] === 'object' || cleanTaskData[field] === '') {
        delete cleanTaskData[field];
      }
    });

    if (editingTask) {
      taskId = editingTask.id;
      await updateMutation.mutateAsync({ id: taskId, data: cleanTaskData });
    } else {
      const res = await createMutation.mutateAsync(cleanTaskData);
      const resTyped = res as { data?: { id?: string }, id?: string };
      taskId = resTyped.data?.id || resTyped.id;
    }

    if (subtasks && subtasks.length > 0) {
      const promises = subtasks.map((sub: any) => {
        if (sub.id) {
          return collaborationApi.tasks.updateSubtask(sub.id, { title: sub.title });
        } else {
          return collaborationApi.tasks.createSubtask({ ...sub, task_id: taskId });
        }
      });
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
    }
  };

  const playSuccessSound = useSound('/sounds/complete.mp3');

  const handleStatusChange = async (task: any, status: string, extraData?: any) => {
    if (status === 'update_subtask') {
      const { subId, is_completed } = extraData;
      await collaborationApi.tasks.updateSubtask(subId, { is_completed });
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['subtasks', task.id] });
      return;
    }

    if (status === 'DONE') {
      playSuccessSound();
    }
    updateMutation.mutate({ id: task.id, data: { status } });
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId;

    if (newStatus === 'DONE') {
      playSuccessSound();
    }

    updateMutation.mutate({ id: taskId, data: { status: newStatus } });
  };

  const filteredTasks = (tasks || []).filter((task: any) => {
    const matchesSearch = !search ||
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.description?.toLowerCase().includes(search.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesPriority && matchesStatus;
  });

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <ListChecks className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Tasks</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                {tasks.length} active work items
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
            <Button
              onClick={() => { setEditingTask(null); setShowForm(true); }}
              className="h-11 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] gap-2"
            >
              <Plus className="w-5 h-5" /> Add Task
            </Button>
          </div>
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

          {search && (
            <Button variant="ghost" size="icon" onClick={() => setSearch('')} className="h-11 w-11 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-5 h-5" />
            </Button>
          )}
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
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
                  onStatusChange={(task: any, status: string) => {
                    handleStatusChange(task, status);
                  }}
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
                    onStatusChange={(taskId: string, status: string, extraData?: any) => handleStatusChange(task, status, extraData)}
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
        onClose={() => { setShowForm(false); setEditingTask(null); }}
        onSubmit={handleSubmit}
        task={editingTask}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Task Detail View */}
      <TaskDetailView
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onEdit={(task: any) => { setSelectedTask(null); setEditingTask(task); setShowForm(true); }}
        onDelete={(task: any) => { setSelectedTask(null); setDeleteTask(task); }}
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
