import React from 'react';
import { motion } from 'framer-motion';
import {
  Flag,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  ArrowUpCircle,
  MoreHorizontal,
  ListChecks,
  MessageSquare,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CollaboratorPreview } from '@/components/shared/CollaboratorPreview';

// Simple date helpers
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  if (checkDate.getTime() === today.getTime()) return 'Today';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

const isPastDate = (dateStr) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
};

const statusConfig = {
  TODO: { icon: Circle, color: 'text-slate-400 dark:text-slate-500' },
  IN_PROGRESS: { icon: ArrowUpCircle, color: 'text-zinc-300 dark:text-zinc-400' },
  DONE: { icon: CheckCircle2, color: 'text-emerald-500 dark:text-emerald-400' },
};

export default function TaskCard({ task, user, onEdit, onDelete, onStatusChange, onOpenDetail, isDragging, onMouseEnter, onMouseLeave, isFocused }) {
  const [showSubtasks, setShowSubtasks] = React.useState(false);
  const currentUserId = String(user?.id || user?.user?.id || '').toLowerCase();
  const taskCreatorId = String(task.creator_id || task.user_id || '').toLowerCase();
  const taskAssigneeId = String(task.assignee_id || task.assigned_to || '').toLowerCase();

  const isCreator = currentUserId === taskCreatorId;
  const isAssignee = currentUserId === taskAssigneeId;

  const hasValidAssignee = taskAssigneeId !== '' && taskAssigneeId !== 'null';
  const canChangeStatus = hasValidAssignee ? isAssignee : isCreator;

  const StatusIcon = statusConfig[task.status]?.icon || Circle;
  const isOverdue = task.due_date && isPastDate(task.due_date) && task.status !== 'DONE';

  const subtasksCount = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter(s => s.is_completed).length || 0;
  const commentsCount = task.task_comments?.length || 0;

  const handleCardClick = (e) => {
    // Only open detail if clicking on the card itself, not interactive elements
    if (e.target === e.currentTarget || e.target.closest('.card-clickable-area')) {
      onOpenDetail?.(task);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -2 }}
      className={cn(
        "relative",
        isDragging ? 'rotate-2 z-50' : '',
        isFocused ? 'z-50' : 'z-0'
      )}
    >
      <Card
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={cn(
          "group/card bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200",
          task.status === 'done' && "opacity-60",
          isFocused && "ring-2 ring-white/20 border-white/30"
        )}
      >
        <CardContent className="p-5" onClick={handleCardClick}>
          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className='flex flex-wrap gap-1.5 mb-3'>
              {task.tags.map((tag, idx) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className={cn(
                    "px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border",
                    idx === 0
                      ? "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900"
                      : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                  )}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-start gap-3">
            {/* Status Checkbox */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (canChangeStatus) onStatusChange(task, task.status === 'DONE' ? 'TODO' : 'DONE');
              }}
              disabled={!canChangeStatus}
              className={cn(
                "mt-0.5 flex-shrink-0 transition-all rounded-full",
                canChangeStatus ? "hover:scale-110 active:scale-95" : "opacity-40 cursor-not-allowed"
              )}
              title={!canChangeStatus ? "Only the assignee can change status" : ""}
            >
              <StatusIcon className={cn("w-5 h-5", statusConfig[task.status]?.color)} />
            </button>

            {/* Main Content */}
            <div className="flex-1 min-w-0 card-clickable-area cursor-pointer">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className={cn(
                  "text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug",
                  task.status === 'DONE' && 'line-through text-slate-500 dark:text-slate-500'
                )}>
                  {task.title}
                </h3>

                {/* Action Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="w-4 h-4 text-slate-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      disabled={!canChangeStatus}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(task, 'TODO');
                      }}
                    >
                      <Circle className="w-4 h-4 mr-2" /> Mark as Todo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canChangeStatus}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(task, 'IN_PROGRESS');
                      }}
                    >
                      <ArrowUpCircle className="w-4 h-4 mr-2" /> Mark In Progress
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canChangeStatus}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(task, 'DONE');
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Done
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      onEdit(task);
                    }}>
                      <Pencil className="w-4 h-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(task);
                      }}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Description */}
              {task.description && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              )}

              {/* Subtasks Preview */}
              {task.subtasks && task.subtasks.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSubtasks(!showSubtasks);
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider transition-colors"
                  >
                    {showSubtasks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showSubtasks ? 'Hide Sub-tasks' : `Show ${task.subtasks.length} Sub-tasks`}
                  </button>

                  {showSubtasks && (
                    <div className="pt-1.5 space-y-1.5">
                      {task.subtasks.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center gap-2 group/sub cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStatusChange?.(task, 'update_subtask', { subId: sub.id, is_completed: !sub.is_completed });
                          }}
                        >
                          <div className={cn(
                            "w-3 h-3 rounded-sm border flex items-center justify-center transition-all",
                            sub.is_completed
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-slate-300 dark:border-slate-700 group-hover/sub:border-slate-400"
                          )}>
                            {sub.is_completed && <CheckCircle2 className="w-2 h-2 text-white" strokeWidth={3} />}
                          </div>
                          <span className={cn(
                            "text-[11px] font-medium transition-colors truncate",
                            sub.is_completed
                              ? "text-slate-400 line-through"
                              : "text-slate-700 dark:text-slate-300"
                          )}>
                            {sub.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer Meta */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  {task.due_date && (
                    <div className={cn(
                      "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
                      isOverdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
                    )}>
                      <Flag className="w-3.5 h-3.5" />
                      {formatDate(task.due_date)}
                    </div>
                  )}

                  {subtasksCount > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      <ListChecks className="w-3.5 h-3.5" />
                      {completedSubtasks}/{subtasksCount}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {commentsCount}
                  </div>

                  {task.team_id ? (
                    <CollaboratorPreview teamId={task.team_id} size="sm" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                        U
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}