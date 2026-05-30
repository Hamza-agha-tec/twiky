'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collaborationApi } from '@/lib/collaboration-api';
import { Target, Plus, Search, X, LayoutGrid, List, Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnimatePresence, motion } from 'framer-motion';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { NoteEditor } from '@/components/notes/NoteEditor';

// Import your existing components
import GoalCard from '@/components/goals/GoalCard';
import GoalForm from '@/components/goals/GoalForm';
import GoalTimelineView from '@/components/goals/GoalTimelineView';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

export default function WorkspaceGoals() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [deleteGoal, setDeleteGoal] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('all'); // 'all', 'personal', 'team', 'timeline'
  const [view, setView] = useState('grid');
  const [focusedGoal, setFocusedGoal] = useState<any>(null);
  const [editingNote, setEditingNote] = useState<any>(null);

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => collaborationApi.goals.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => collaborationApi.goals.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => collaborationApi.goals.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setEditingGoal(null);
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => collaborationApi.goals.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setDeleteGoal(null);
    },
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

  const handleEdit = (goal: any) => {
    setEditingGoal(goal);
    setShowForm(true);
  };

  const filteredGoals = goals.filter((goal: any) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search ||
      goal.title?.toLowerCase().includes(searchLower) ||
      goal.description?.toLowerCase().includes(searchLower);

    const matchesScope = scope === 'all' || scope === 'timeline' ||
      (scope === 'personal') ||
      (scope === 'team');

    return matchesSearch && matchesScope;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Target className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Goals</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                {goals.length} objectives to achieve
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Scope Filter */}
            <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm items-center h-11">
              <div className="flex w-full h-full gap-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'personal', label: 'Personal' },
                  { id: 'team', label: 'Team', icon: Users },
                  { id: 'timeline', label: 'Timeline', icon: Calendar }
                ].map((option) => {
                  const isActive = scope === option.id;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setScope(option.id)}
                      className={cn(
                        "relative cursor-pointer flex items-center gap-2 px-4 h-8 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-300 z-10",
                        isActive ? "text-white dark:text-slate-900" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeGoalScope"
                          className="absolute inset-0 bg-slate-900 dark:bg-white rounded-lg shadow-sm"
                          transition={{ type: "spring", bounce: 0.1, duration: 0.5 }}
                        />
                      )}
                      {Icon && <Icon className="w-3.5 h-3.5 relative z-20" />}
                      <span className="relative z-20">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={() => { setEditingGoal(null); setShowForm(true); }}
              className="h-11 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] gap-2"
            >
              <Plus className="w-5 h-5" /> Add Goal
            </Button>
          </div>
        </div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-3 mb-10"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search goals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus-visible:ring-slate-400 font-medium text-sm shadow-sm"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-11 px-1.5">
            <button
              onClick={() => setView('grid')}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                view === 'grid' ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
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

        {/* Timeline View */}
        {scope === 'timeline' ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-[600px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-950"
          >
            <GoalTimelineView goals={filteredGoals} teamMembers={[]} />
          </motion.div>
        ) : (
          /* Grid/List View */
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
              </div>
            ) : filteredGoals.length > 0 ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className={cn(
                    "grid gap-6",
                    view === 'grid'
                      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                      : "grid-cols-1"
                  )}
                >
                  {filteredGoals.map((goal: any) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onEdit={handleEdit}
                      onDelete={setDeleteGoal}
                      onUpdate={updateMutation.mutate}
                      onMouseEnter={() => setFocusedGoal(goal)}
                      onMouseLeave={() => setFocusedGoal(null)}
                      isFocused={focusedGoal?.id === goal.id}
                      onCreateTaskFromMilestone={() => {}}
                      onEditNote={(note: any) => setEditingNote(note)}
                      focusedNoteId={editingNote?.id}
                      onNoteEnter={() => {}}
                      onNoteLeave={() => {}}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
                  <Target className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No goals yet</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                  Create your first goal to start tracking your objectives and milestones.
                </p>
                <Button onClick={() => { setEditingGoal(null); setShowForm(true); }} className="gap-2">
                  <Plus className="w-4 h-4" /> Add Goal
                </Button>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Goal Form */}
      <GoalForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingGoal(null); }}
        onSubmit={handleSubmit}
        goal={editingGoal}
        isLoading={createMutation.isPending || updateMutation.isPending}
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteGoal}
        onOpenChange={() => setDeleteGoal(null)}
        title="Delete Goal"
        description="Are you sure you want to delete this goal? This action cannot be undone."
        confirmText="Delete"
        onConfirm={() => deleteGoal && deleteMutation.mutate(deleteGoal.id)}
      />
    </div>
  );
}
