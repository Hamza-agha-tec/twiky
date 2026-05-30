'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collaborationApi } from '@/lib/collaboration-api';
import { StickyNote, Plus, Search, Pin, X, LayoutGrid, List, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnimatePresence, motion, LayoutGroup } from 'framer-motion';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { cn } from '@/lib/utils';

// Import your existing components
import { NoteCard } from '@/components/notes/NoteCard';
import { NoteEditor } from '@/components/notes/NoteEditor';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

export default function WorkspaceNotes() {
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [deleteNote, setDeleteNote] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [focusedNote, setFocusedNote] = useState<any>(null);
  const [scopeFilter, setScopeFilter] = useState('all');
  const [view, setView] = useState('grid');
  const isCreating = useRef(false);
  const activeNoteId = useRef<string | null>(null);

  useEffect(() => {
    activeNoteId.current = selectedNote?.id || null;
  }, [selectedNote?.id]);

  useKeyboardShortcut('Delete', () => {
    if (focusedNote) setDeleteNote(focusedNote);
  });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: () => collaborationApi.notes.list(''), // List all notes for user
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => collaborationApi.notes.create({ ...data, project_id: '' }),
    onSuccess: (newNote) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setSelectedNote(newNote);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => collaborationApi.notes.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => collaborationApi.notes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setDeleteNote(null);
      setShowEditor(false);
      setSelectedNote(null);
    },
  });

  const handleSave = async (data: any, isAutoSave = false) => {
    if (activeNoteId.current) {
      await updateMutation.mutateAsync({ id: activeNoteId.current, data });
    } else {
      if (isCreating.current) return;
      isCreating.current = true;
      try {
        const newNote: any = await createMutation.mutateAsync(data);
        if (newNote?.id) {
          activeNoteId.current = newNote.id;
          setSelectedNote(newNote);
        }
        if (!isAutoSave) setShowEditor(false);
      } catch (error) {
        console.error('Failed to create note:', error);
      } finally {
        isCreating.current = false;
      }
    }
  };

  const handleNoteClick = (note: any) => {
    setSelectedNote(note);
    activeNoteId.current = note.id;
    setShowEditor(true);
  };

  const handleNewNote = () => {
    setSelectedNote(null);
    activeNoteId.current = null;
    setShowEditor(true);
  };

  const handleTogglePin = (note: any) => {
    updateMutation.mutate({ id: note.id, data: { is_pinned: !note.is_pinned } });
  };

  const filteredNotes = notes.filter((note: any) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search ||
      note.title?.toLowerCase().includes(searchLower) ||
      note.content?.toLowerCase().includes(searchLower) ||
      note.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower));

    const matchesScope = scopeFilter === 'all' ||
      (scopeFilter === 'personal' && !note.project_id) ||
      (scopeFilter === 'team' && note.project_id);

    return matchesSearch && matchesScope;
  });

  const pinnedNotes = filteredNotes.filter((n: any) => n.is_pinned);
  const otherNotes = filteredNotes.filter((n: any) => !n.is_pinned);

  return (
    <LayoutGroup>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-5">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <StickyNote className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Notes</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {notes.length} saved ideas & fragments
                </p>
              </div>
            </div>

            <Button
              onClick={handleNewNote}
              className="h-11 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] gap-2"
            >
              <Plus className="w-5 h-5" /> New Note
            </Button>
          </div>

          {/* Search & Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 mb-10"
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search thoughts, tags, or content..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 pl-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus-visible:ring-slate-400 font-medium text-sm shadow-sm"
              />
            </div>

            {/* Scope Filter */}
            <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm items-center h-11">
              <div className="flex w-full h-full gap-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'personal', label: 'Personal' },
                  { id: 'team', label: 'Shared', icon: Users }
                ].map((option) => {
                  const isActive = scopeFilter === option.id;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setScopeFilter(option.id)}
                      className={cn(
                        "relative cursor-pointer flex items-center gap-2 px-4 h-8 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-300 z-10",
                        isActive ? "text-white dark:text-slate-900" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeScope"
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

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-11 px-1.5">
              <button
                onClick={() => setView('grid')}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                  view === 'grid' ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                  view === 'list' ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
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

          {/* Notes Grid/List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : filteredNotes.length > 0 ? (
            <div className="space-y-8">
              <AnimatePresence mode="popLayout">
                {pinnedNotes.length > 0 && (
                  <motion.div
                    key="pinned-section"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex items-center gap-2 mb-6 ml-1">
                      <Pin className="w-3.5 h-3.5 text-slate-400" />
                      <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pinned</h2>
                    </div>
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className={cn(
                        "grid gap-4",
                        view === 'grid'
                          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                          : "grid-cols-1"
                      )}
                    >
                      <AnimatePresence>
                        {pinnedNotes.map((note: any) => (
                          <NoteCard
                            key={note.id}
                            note={note}
                            onClick={handleNoteClick}
                            onEdit={handleNoteClick}
                            onDelete={setDeleteNote}
                            onTogglePin={handleTogglePin}
                            onMouseEnter={() => setFocusedNote(note)}
                            onMouseLeave={() => setFocusedNote(null)}
                            isFocused={focusedNote?.id === note.id}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                )}

                {otherNotes.length > 0 && (
                  <motion.div
                    key="other-section"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {pinnedNotes.length > 0 && (
                      <div className="flex items-center gap-2 mb-6 ml-1 mt-8">
                        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Others</h2>
                      </div>
                    )}
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className={cn(
                        "grid gap-4",
                        view === 'grid'
                          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                          : "grid-cols-1"
                      )}
                    >
                      <AnimatePresence>
                        {otherNotes.map((note: any) => (
                          <NoteCard
                            key={note.id}
                            note={note}
                            onClick={handleNoteClick}
                            onEdit={handleNoteClick}
                            onDelete={setDeleteNote}
                            onTogglePin={handleTogglePin}
                            onMouseEnter={() => setFocusedNote(note)}
                            onMouseLeave={() => setFocusedNote(null)}
                            isFocused={focusedNote?.id === note.id}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
                <StickyNote className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No notes yet</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                Create your first note to start capturing ideas, thoughts, and important information.
              </p>
              <Button onClick={handleNewNote} className="gap-2">
                <Plus className="w-4 h-4" /> Create Note
              </Button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Note Editor Sheet */}
      <NoteEditor
        open={showEditor}
        onClose={() => {
          setShowEditor(false);
          setSelectedNote(null);
          activeNoteId.current = null;
        }}
        note={selectedNote}
        onSave={handleSave}
        onDelete={() => selectedNote && setDeleteNote(selectedNote)}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteNote}
        onOpenChange={() => setDeleteNote(null)}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete"
        onConfirm={() => { if (deleteNote) deleteMutation.mutate(deleteNote.id) }}
        variant="destructive"
      />
    </LayoutGroup>
  );
}
