import React, { useState, useEffect } from 'react';
import { X, Maximize2, Minimize2, ChevronsLeftRight, Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Lora } from 'next/font/google';

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
});

import { useQuery } from '@tanstack/react-query';
import { collaborationApi } from '@/lib/collaboration-api';

export default function TaskForm({ open, onClose, onSubmit, task, isLoading }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium',
    status: 'TODO',
    tags: [],
    subtasks: [],
  });
  const [subtaskInput, setSubtaskInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [viewMode, setViewMode] = useState('default');

  useEffect(() => {
    if (!open) setViewMode('default');
  }, [open]);

  const { data: existingSubtasks = [] } = useQuery({
    queryKey: ['subtasks', task?.id],
    queryFn: () => collaborationApi.tasks.getSubtasks(task?.id),
    enabled: !!task?.id && open,
  });

  useEffect(() => {
    if (existingSubtasks.length > 0 && task) {
      setFormData(prev => ({ ...prev, subtasks: existingSubtasks }));
    }
  }, [existingSubtasks, task]);

  const getViewClass = () => {
    switch (viewMode) {
      case 'full': return 'sm:max-w-full sm:w-full';
      case 'large': return 'sm:max-w-4xl';
      default: return 'sm:max-w-2xl';
    }
  };

  const toggleFull = () => setViewMode(v => v === 'full' ? 'default' : 'full');
  const toggleLarge = () => setViewMode(v => v === 'large' ? 'default' : 'large');

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        due_date: task.due_date || '',
        priority: task.priority || 'medium',
        status: task.status || 'TODO',
        tags: task.tags || [],
        subtasks: formData.subtasks.length > 0 ? formData.subtasks : (existingSubtasks || []),
      });
    } else {
      setFormData({
        title: '',
        description: '',
        due_date: '',
        priority: 'medium',
        status: 'TODO',
        tags: [],
        subtasks: [],
      });
    }
  }, [task, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const addSubtask = () => {
    if (subtaskInput.trim()) {
      setFormData({
        ...formData,
        subtasks: [...formData.subtasks, { title: subtaskInput.trim(), is_completed: false }]
      });
      setSubtaskInput('');
    }
  };

  const removeSubtask = (index) => {
    setFormData({
      ...formData,
      subtasks: formData.subtasks.filter((_, i) => i !== index)
    });
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className={`${getViewClass()} w-full p-0 flex flex-col border-none bg-white dark:bg-slate-900 transition-all duration-500 ${lora.variable}`}>
        <SheetHeader className="p-6 pb-2 space-y-4 text-left">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {task ? 'Update Work Item' : 'New Task'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-1.5 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("default")}
                  className={`h-6 w-6 rounded-md transition-all ${viewMode === 'default' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Standard"
                >
                  <Minimize2 className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("large")}
                  className={`h-6 w-6 rounded-md transition-all ${viewMode === 'large' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Large"
                >
                  <ChevronsLeftRight className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("full")}
                  className={`h-6 w-6 rounded-md transition-all ${viewMode === 'full' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Full"
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-6 flex-1 overflow-y-auto min-h-0 px-6 pb-10">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Core objective..."
                required
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-5 focus-visible:ring-slate-400 font-medium text-sm transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Context & Details</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Elaborate on the requirements..."
                rows={4}
                className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-5 py-3 focus-visible:ring-slate-400 font-medium text-sm transition-all resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="due_date" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Target Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="h-11 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-5 focus-visible:ring-slate-400 font-medium text-sm text-slate-500"
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label htmlFor="priority" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger className="h-11 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-5 focus-visible:ring-slate-400 font-medium text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-slate-200 dark:border-slate-800">
                  <SelectItem value="low" className="text-xs font-medium">Low Priority</SelectItem>
                  <SelectItem value="medium" className="text-xs font-medium">Normal Level</SelectItem>
                  <SelectItem value="high" className="text-xs font-medium">Critical / High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Initial Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger className="h-11 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-5 focus-visible:ring-slate-400 font-medium text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-slate-200 dark:border-slate-800">
                <SelectItem value="TODO" className="text-xs font-medium">Backlog / To Do</SelectItem>
                <SelectItem value="IN_PROGRESS" className="text-xs font-medium">Actively Working</SelectItem>
                <SelectItem value="DONE" className="text-xs font-medium">Mark Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Breakdown (Sub-tasks)</Label>
              <div className="flex gap-2">
                <Input
                  value={subtaskInput}
                  onChange={(e) => setSubtaskInput(e.target.value)}
                  placeholder="Task small step..."
                  className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 focus-visible:ring-slate-400 font-medium text-xs"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                />
                <Button type="button" variant="outline" onClick={addSubtask} className="h-10 rounded-xl px-4 border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider">Add</Button>
              </div>
              {formData.subtasks.length > 0 && (
                <div className="space-y-2 mt-3">
                  {formData.subtasks.map((sub, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 group transition-all">
                      <div className="w-4 h-4 rounded-full border border-slate-300 flex-shrink-0" />
                      <span className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-300">{sub.title}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSubtask(idx)}
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Categorization</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="New tag..."
                  className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 focus-visible:ring-slate-400 font-medium text-xs"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" variant="outline" onClick={addTag} className="h-10 rounded-xl px-4 border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider">Add</Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
                      {tag}
                      <X className="w-2.5 h-2.5 cursor-pointer opacity-60 hover:opacity-100" onClick={() => removeTag(tag)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 mt-8">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-12 px-6 rounded-xl font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.title}
              className="h-12 px-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-sm active:scale-95 transition-all"
            >
              {isLoading ? 'Saving...' : task ? 'Update Item' : 'Confirm Task'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}