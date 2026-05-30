'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, LayoutGrid, List, StickyNote, X } from 'lucide-react';
import { collaborationApi } from '@/lib/collaboration-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AnimatePresence, motion, LayoutGroup } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

// Import existing components
import { NoteCard } from '@/components/notes/NoteCard';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

export function ProjectNotesView({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  
  const [showEditor, setShowEditor] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [deleteNote, setDeleteNote] = useState<any>(null);
  const [focusedNote, setFocusedNote] = useState<any>(null);
  
  const isCreating = useRef(false);
  const activeNoteId = useRef<string | null>(null);

  useEffect(() => {
    activeNoteId.current = selectedNote?.id || null;
  }, [selectedNote?.id]);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['project-notes', projectId],
    queryFn: () => collaborationApi.notes.list(projectId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      collaborationApi.notes.create({
        ...data,
        project_id: projectId,
      }),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ['project-notes', projectId] });

      const createdNote = note;
      setSelectedNote(createdNote);
      activeNoteId.current = createdNote.id;
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create note'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      collaborationApi.notes.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-notes', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => collaborationApi.notes.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-notes', projectId] });
      setDeleteNote(null);
      setShowEditor(false);
      setSelectedNote(null);
      toast.success('Note deleted');
    },
    onError: () => toast.error('Failed to delete note'),
  });

  const handleSave = async (data: any, isAutoSave = false) => {
    if (activeNoteId.current) {
      await updateMutation.mutateAsync({ id: activeNoteId.current, data });
    } else {
      if (isCreating.current) return;
      isCreating.current = true;
      try {
        const res = await createMutation.mutateAsync(data);
        const response = res as { data?: any } | any;
        const createdNote = response.data || response;
        if (createdNote?.id) {
          activeNoteId.current = createdNote.id;
          setSelectedNote(createdNote);
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
    updateMutation.mutate({ 
      id: note.id, 
      data: { is_pinned: !note.is_pinned } 
    });
  };

  const filteredNotes = (Array.isArray(notes) ? notes : []).filter((n: any) => { 
    const searchLower = search.toLowerCase(); 
    return !search || 
      (n.title || '').toLowerCase().includes(searchLower) || 
      (n.content || '').toLowerCase().includes(searchLower) ||
      (n.tags || []).some((tag: string) => tag.toLowerCase().includes(searchLower));
  });

  const pinnedNotes = filteredNotes.filter((n: any) => n.is_pinned);
  const otherNotes = filteredNotes.filter((n: any) => !n.is_pinned);

  return (
    <LayoutGroup>
      <div className="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-slate-950 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          {/* Header */}
          <div className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <StickyNote className="h-6 w-6 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Project Notes</h1>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {(notes || []).length} saved ideas & fragments
                </p>
              </div>
            </div>

            <Button
              onClick={handleNewNote}
              className="h-11 gap-2 rounded-xl bg-slate-900 px-5 font-bold text-white shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] dark:bg-white dark:text-slate-900"
            >
              <Plus className="h-5 w-5" /> New Note
            </Button>
          </div>

          {/* Search & Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-10 flex items-center gap-3"
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search thoughts, tags, or content..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white pl-11 text-sm font-medium shadow-sm focus-visible:ring-slate-400 dark:border-slate-800 dark:bg-slate-900"
              />
            </div>

            {/* View Toggle */}
            <div className="flex h-11 items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 px-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <button
                onClick={() => setView('grid')}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                  view === 'grid' ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                  view === 'list' ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {search && (
              <Button variant="ghost" size="icon" onClick={() => setSearch('')} className="h-11 w-11 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </Button>
            )}
          </motion.div>

          {/* Notes Grid/List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
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
                    <div className="mb-6 ml-1 flex items-center gap-2">
                      <StickyNote className="h-3.5 w-3.5 text-slate-400" />
                      <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pinned</h2>
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
                      <div className="mb-6 ml-1 mt-8 flex items-center gap-2">
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Others</h2>
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
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900">
                <StickyNote className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">No notes yet</h3>
              <p className="mb-6 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                Create your first note to start capturing ideas, thoughts, and important information.
              </p>
              <Button onClick={handleNewNote} className="gap-2">
                <Plus className="h-4 w-4" /> Create Note
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
