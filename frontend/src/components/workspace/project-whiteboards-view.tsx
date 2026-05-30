'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collaborationApi } from '@/lib/collaboration-api';
import { Presentation, Plus, Search, X, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WhiteBoardCard } from '@/components/whiteboard/WhiteBoardCard';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';

import { useParams } from 'next/navigation';

export function ProjectWhiteboardsView({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const params = useParams();
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: whiteboards = [], isLoading } = useQuery({
    queryKey: ['project-whiteboards', projectId],
    queryFn: () => collaborationApi.whiteboards.list(projectId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      collaborationApi.whiteboards.create({
        title: 'Untitled Whiteboard',
        project_id: projectId,
        data: { elements: [], appState: {} },
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['project-whiteboards', projectId] });
      const id = res.id;
      if (id) {
        window.open(`/channels/${params.channelId}/projects/${projectId}/whiteboards/${id}`, '_blank');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => collaborationApi.whiteboards.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-whiteboards', projectId] });
      setDeletingId(null);
    },
  });

  const openEditor = (wb: any) => {
    window.open(`/channels/${params.channelId}/projects/${projectId}/whiteboards/${wb.id}`, '_blank');
  };

  const filteredWhiteboards = (Array.isArray(whiteboards) ? whiteboards : []).filter((wb: any) =>
    (wb.title || wb.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-5">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <Presentation className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Whiteboards</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {whiteboards.length} visual collaboration spaces
                </p>
              </div>
            </div>

            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="h-11 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] gap-2"
            >
              <Plus className="w-5 h-5" /> New Whiteboard
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-10">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search whiteboards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 pl-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus-visible:ring-slate-400 font-medium text-sm shadow-sm"
              />
            </div>

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
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredWhiteboards.length > 0 ? (
            <div className={cn(
              "grid gap-6",
              view === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
            )}>
              {filteredWhiteboards.map((wb: any) => (
                <WhiteBoardCard
                  onMouseEnter={() => {}}
                  onMouseLeave={() => {}}
                  isFocused={false}
                  key={wb.id}
                  wb={wb}
                  onEdit={openEditor}
                  setDeletingId={setDeletingId}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
                <Presentation className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No whiteboards yet</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                Create a whiteboard to start brainstorming and visualizing ideas within your channel.
              </p>
              <Button onClick={() => createMutation.mutate()} className="gap-2">
                <Plus className="w-4 h-4" /> Create Whiteboard
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deletingId}
        onOpenChange={(open: boolean) => !open && setDeletingId(null)}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
        title="Delete Whiteboard"
        description="Are you sure you want to permanently delete this whiteboard? This action cannot be undone."
      />
    </div>
  );
}

