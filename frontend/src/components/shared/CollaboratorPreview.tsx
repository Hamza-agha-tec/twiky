import React from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollaboratorPreviewProps {
  teamId?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CollaboratorPreview({ teamId, size = 'sm', className }: CollaboratorPreviewProps) {
  if (!teamId) return null;

  return (
    <div className={cn("flex items-center gap-1 text-slate-500", className)}>
      <Users className={cn(
        size === 'sm' ? "w-3 h-3" : size === 'md' ? "w-4 h-4" : "w-5 h-5"
      )} />
      <span className={cn(
        size === 'sm' ? "text-[10px]" : size === 'md' ? "text-xs" : "text-sm",
        "font-medium"
      )}>Team</span>
    </div>
  );
}
