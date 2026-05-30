'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collaborationApi } from '@/lib/collaboration-api';
import { useRouter } from 'next/navigation';
import { Layout, Plus, Search, X, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnimatePresence, motion } from 'framer-motion';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

// Import your existing component
import { WhiteBoardCard } from '@/components/whiteboard/WhiteBoardCard';

import { toast } from 'sonner';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

export default function WorkspaceWhiteboards() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [focusedWhiteboard, setFocusedWhiteboard] = useState<any>(null);
  const [deleteWhiteboard, setDeleteWhiteboard] = useState<any>(null);
  const [selectedWhiteboard, setSelectedWhiteboard] = useState<any>(null);

  const { data: whiteboards = [], isLoading } = useQuery({
    queryKey: ['whiteboards'],
    queryFn: () => collaborationApi.whiteboards.list(''), // Fetch all for workspace view
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => collaborationApi.whiteboards.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whiteboards'] });
      setDeleteWhiteboard(null);
    },
  });

  const filteredWhiteboards = whiteboards.filter((wb: any) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search || wb.title?.toLowerCase().includes(searchLower);
    return matchesSearch;
  });

  const openEditor = (wb: any) => {
    // Navigate to the absolute project path
    const channelId = wb.channel_id || 'none';
    const projectId = wb.project_id || 'none';
    router.push(`/channels/${channelId}/projects/${projectId}/whiteboards/${wb.id}`);
  };

  const handleOpenEditor = (wb: any) => {
    openEditor(wb);
  };

  const handleCreateNew = async () => {
    try {
      const result = await collaborationApi.whiteboards.create({
        title: 'Untitled Whiteboard',
        project_id: '', // The backend should handle this or we might need a default project
        data: { elements: [], appState: {} }
      });
      queryClient.invalidateQueries({ queryKey: ['whiteboards'] });
      openEditor(result);
      toast.success('Whiteboard created');
    } catch (error) {
      toast.error('Error creating whiteboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Layout className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Whiteboards</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                {whiteboards.length} visual workspaces
              </p>
            </div>
          </div>

          <Button
            onClick={handleCreateNew}
            className="h-11 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] gap-2"
          >
            <Plus className="w-5 h-5" /> New Whiteboard
          </Button>
        </div>

        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center gap-3 mb-10"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search whiteboards..."
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

        {/* Whiteboards Grid/List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : filteredWhiteboards.length > 0 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              variants={containerVariants}
              className={cn(
                "grid gap-4",
                view === 'grid'
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "grid-cols-1"
              )}
            >
              <button
                onClick={handleCreateNew}
                className="flex flex-col items-center justify-center h-full min-h-[200px] rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all group"
              >
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                </div>
                <span className="font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200">Create New</span>
              </button>

              {filteredWhiteboards.map((wb: any) => (
                    <WhiteBoardCard
                      key={wb.id}
                      wb={wb}
                      onEdit={() => openEditor(wb)}
                      setDeletingId={(id: string) => setDeleteWhiteboard({ id })}
                      onMouseEnter={() => setFocusedWhiteboard(wb)}
                      onMouseLeave={() => setFocusedWhiteboard(null)}
                      isFocused={focusedWhiteboard?.id === wb.id}
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
              <Layout className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No whiteboards yet</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
              Create your first whiteboard to start brainstorming, diagramming, and collaborating visually.
            </p>
            <Button onClick={() => {}} className="gap-2">
              <Plus className="w-4 h-4" /> Create Whiteboard
            </Button>
          </motion.div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteWhiteboard}
        onOpenChange={() => setDeleteWhiteboard(null)}
        title="Delete Whiteboard"
        description="Are you sure you want to delete this whiteboard? This action cannot be undone."
        confirmText="Delete"
        onConfirm={() => deleteWhiteboard && deleteMutation.mutate(deleteWhiteboard.id)}
      />
    </div>
  );
}
