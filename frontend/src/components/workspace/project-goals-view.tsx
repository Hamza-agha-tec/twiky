'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collaborationApi } from '@/lib/collaboration-api';
import { Target, Plus,  Calendar, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GoalCard from '@/components/goals/GoalCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import GoalForm from '@/components/goals/GoalForm';
import GoalTimelineView from '@/components/goals/GoalTimelineView';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';


export function ProjectGoalsView({ projectId }: { projectId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [viewType, setViewType] = useState('grid'); // 'grid', 'timeline'
  const [deleteGoal, setDeleteGoal] = useState<any>(null);
  const [focusedGoal, setFocusedGoal] = useState<any>(null);

  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['project-goals', projectId],
    queryFn: () => collaborationApi.goals.list(projectId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      collaborationApi.goals.create({
        ...data,
        project_id: projectId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-goals', projectId] });
      setShowForm(false);
    },
    onError: (err: any) => {
      console.error('Failed to create goal:', err);
      toast.error(err.message || 'Failed to create goal');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => collaborationApi.goals.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-goals', projectId] });
      setEditingGoal(null);
      setShowForm(false);
    },
    onError: (err: any) => {
      console.error('Failed to update goal:', err);
      toast.error(err.message || 'Failed to update goal');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => collaborationApi.goals.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-goals', projectId] });
      setDeleteGoal(null);
    },
    onError: (err: any) => {
      console.error('Failed to delete goal:', err);
      toast.error(err.message || 'Failed to delete goal');
    }
  });

  const createNoteMutation = useMutation({
    mutationFn: (data: any) => collaborationApi.goals.createNote(data.goal_id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goalNotes'] }),
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => collaborationApi.notes.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goalNotes'] }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: ({ goalId, noteId }: { goalId: string; noteId: string }) =>
      collaborationApi.goals.deleteNote(goalId, noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goalNotes'] }),
  });

  const handleSubmit = (data: any) => {
    if (editingGoal) {
      updateMutation.mutate({ id: editingGoal.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const COLORS = ['#94a3b8', '#3b82f6', '#10b981', '#ef4444'];

  const statusDistribution = (goals || []).reduce((acc: any, g: any) => {
    acc[g.status] = (acc[g.status] || 0) + 1;
    return acc;
  }, {});

  const statusChartData = Object.entries(statusDistribution).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value
  }));

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fcfcfd] dark:bg-slate-950 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-16">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Goals</h1>
              <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium tracking-tight">
                Manage and track strategic objectives for this project
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm items-center h-11">
                <div className="flex w-full h-full gap-1">
                  {[
                    { id: 'grid', label: 'Grid', icon: LayoutGrid },
                    { id: 'timeline', label: 'Timeline', icon: Calendar }
                  ].map((option) => {
                    const isActive = viewType === option.id;
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setViewType(option.id)}
                        className={cn(
                          "relative cursor-pointer flex items-center gap-2 px-4 h-8 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-300 z-10",
                          isActive ? "text-white dark:text-slate-900" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeView"
                            className="absolute inset-0 bg-slate-900 dark:bg-white rounded-lg shadow-sm"
                            transition={{ type: "spring", bounce: 0.1, duration: 0.5 }}
                          />
                        )}
                        {Icon && <Icon className={cn("w-3.5 h-3.5 relative z-20")} />}
                        <span className="relative z-20">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button
                onClick={() => { setEditingGoal(null); setShowForm(true); }}
                className="h-11 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-sm transition-all hover:bg-slate-800 dark:hover:bg-slate-100 gap-2 border border-slate-200 dark:border-slate-800"
              >
                <Plus className="w-4 h-4" /> Add Goal
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : viewType === 'timeline' ? (
            <GoalTimelineView goals={goals || []} teamMembers={[]} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(goals || []).map((goal: any) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={() => { setEditingGoal(goal); setShowForm(true); }}
                  onDelete={() => setDeleteGoal(goal)}
                  onUpdate={(data: any) => updateMutation.mutate({ id: goal.id, data })}
                  onCreateTaskFromMilestone={() => {}}
                  onMouseEnter={() => setFocusedGoal(goal)}
                  onMouseLeave={() => setFocusedGoal(null)}
                  isFocused={focusedGoal?.id === goal.id}
                  onEditNote={(note: any) => setEditingNote(note)}
                  focusedNoteId={editingNote?.id}
                  onNoteEnter={() => {}}
                  onNoteLeave={() => {}}
                />
              ))}
            </div>
          )}

          {!isLoading && (goals || []).length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No goals set</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                Start by defining your first project objective to track progress.
              </p>
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Create Goal
              </Button>
            </div>
          )}
        </div>
      </div>

      <GoalForm
        isLoading={createMutation.isPending || updateMutation.isPending}
        open={showForm}
        onClose={() => { setShowForm(false); setEditingGoal(null); }}
        onSubmit={handleSubmit}
        goal={editingGoal}
      />

      <ConfirmDialog
        isOpen={!!deleteGoal}
        onOpenChange={() => setDeleteGoal(null)}
        title="Delete Goal"
        description="Are you sure? This will permanently remove this goal and its associated data."
        confirmText="Delete"
        onConfirm={() => deleteGoal && deleteMutation.mutate(deleteGoal.id)}
      />

      <NoteEditor
        open={!!editingNote}
        onClose={() => setEditingNote(null)}
        note={editingNote?.id === 'new' ? null : editingNote}
        onSave={(data: any, isAutoSave?: boolean) => {
          if (editingNote?.id === 'new') {
            setEditingNote((prev: any) => ({ ...prev, ...data }));
            createNoteMutation.mutate({
              goal_id: editingNote.goal_id,
              progress_point: editingNote.progress_point,
              milestone: editingNote.milestone,
              title: data.title,
              content: data.content,
              color: data.color,
              is_favorite: data.is_pinned,
            });
          } else {
            updateNoteMutation.mutate({
              id: editingNote.id,
              data: {
                title: data.title,
                content: data.content,
                color: data.color,
                is_favorite: data.is_pinned
              }
            });
          }
          if (!isAutoSave) setEditingNote(null);
        }}
        onDelete={(note: any) => {
          if (note?.id && editingNote?.goal_id) {
            deleteNoteMutation.mutate({ goalId: editingNote.goal_id, noteId: note.id });
          }
          setEditingNote(null);
        }}
        isLoading={createNoteMutation.isPending || updateNoteMutation.isPending}
      />
    </div>
  );
}

