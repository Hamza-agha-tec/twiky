'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Pin, MoreHorizontal, Edit3, Trash2, Pencil, Calendar, Heart, Users } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CollaboratorPreview } from '@/components/shared/CollaboratorPreview';


const formatDate = (dateValue) => {
  if (!dateValue) return 'N/A';
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? 'Invalid Date' : format(date, 'MMM d, yyyy');
};

const stripHtml = (html) => {
  if (!html) return '';
  const plain = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*(>|$)/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (plain.length > 120) return plain.substring(0, 120) + '...';
  return plain;
};


const NOTE_COLORS = [
  { name: 'slate', value: 'bg-white border-slate-200/60 dark:bg-slate-900 dark:border-slate-800/60' },
  { name: 'amber', value: 'bg-amber-50/50 border-amber-100/60 dark:bg-amber-900/10 dark:border-amber-900/20' },
  { name: 'blue', value: 'bg-zinc-50/50 border-zinc-200/60 dark:bg-zinc-900/20 dark:border-zinc-700/30' },
  { name: 'green', value: 'bg-green-50/50 border-green-100/60 dark:bg-green-900/10 dark:border-green-900/20' },
  { name: 'rose', value: 'bg-rose-50/50 border-rose-100/60 dark:bg-rose-900/10 dark:border-rose-900/20' },
  { name: 'indigo', value: 'bg-indigo-50/30 border-indigo-100/50 dark:bg-indigo-900/5 dark:border-indigo-900/20' },
];

export const NoteCard = ({ note, onClick, onEdit, onDelete, onTogglePin, onMouseEnter, onMouseLeave, isFocused }) => {
  const colorObj = NOTE_COLORS.find(c => c.name === note.color) || NOTE_COLORS[0];
  const dateStr = formatDate(note.updated_date || note.created_at);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      whileHover={{ y: -2 }}
      onClick={() => onClick && onClick(note)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="h-full"
    >
      <Card className={cn(
        "h-full transition-all duration-300 cursor-pointer overflow-hidden flex flex-col rounded-2xl shadow-sm hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700",
        colorObj.value,
        isFocused && "ring-1 ring-slate-300 dark:ring-slate-700 border-slate-300 dark:border-slate-700"
      )}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
          <div className="flex flex-col gap-1 min-w-0 pr-2">
            <CardTitle className="text-base font-semibold leading-tight truncate text-slate-900 dark:text-slate-100">
              {note.title || "Untitled Note"}
            </CardTitle>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              <Calendar className="w-3 h-3" />
              {dateStr}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {note.is_pinned && (
              <Badge variant="secondary" className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 h-6 px-1.5 rounded-lg border-none">
                <Pin className="w-3 h-3" />
              </Badge>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 -mr-2 text-slate-400 hover:text-slate-600 focus:ring-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(note); }}>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin(note); }}>
                  <Pin className="w-4 h-4 mr-2" />
                  {note.is_pinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={(e) => { e.stopPropagation(); onDelete(note); }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 flex-1">
          <p className="text-[13px] text-slate-600 dark:text-slate-400 line-clamp-4 leading-relaxed whitespace-pre-wrap font-medium">
            {stripHtml(note.content) || <span className="text-slate-300 italic">No content</span>}
          </p>
        </CardContent>

        <CardFooter className="p-4 pt-0 flex flex-wrap gap-2 mt-auto">
          {note.tags && note.tags.length > 0 ? (
            note.tags.map((tag, i) => (
              <Badge key={i} variant="outline" className="border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[9px] px-1.5 py-0 h-4 font-semibold uppercase tracking-wider rounded-md">
                {tag}
              </Badge>
            ))
          ) : (
            <div className="h-4" /> // Spacer if no tags
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
