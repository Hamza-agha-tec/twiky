'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    X,
    Plus,
    CheckCircle2,
    Circle,
    MessageSquare,
    Smile,
    Send,
    Edit3,
    Trash2,
    GripVertical,
    Calendar,
    Paperclip,
    Heart,
    Reply,
    AtSign,
    MoreVertical,
    ChevronDown,
    ArrowUpCircle
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collaborationApi } from '@/lib/collaboration-api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { CollaboratorPreview } from '@/components/shared/CollaboratorPreview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/context/AuthContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { channelsApi } from '@/lib/channels-api';
import { useParams } from 'next/navigation';

// Date formatting helper
const formatDate = (dateStr, formatType = 'full') => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';

        if (formatType === 'time') {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    } catch (e) {
        return '';
    }
};

export default function TaskDetailView({ task, isOpen, onClose, onEdit, onDelete }) {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('progress');
    const [subtaskInput, setSubtaskInput] = useState('');
    const [commentInput, setCommentInput] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [showTagList, setShowTagList] = useState(false);
    const [tagSearchTerm, setTagSearchTerm] = useState('');
    const params = useParams();

    // Fetch Channel Members for mentions
    const { data: channelMembers = [] } = useQuery({
        queryKey: ['channel-members', params?.channelId],
        queryFn: () => channelsApi.getMembers(params?.channelId),
        enabled: !!params?.channelId,
    });
    const teamMembers = channelMembers.map(m => ({
        id: m.user?.id,
        display_name: m.user?.username,
        user_tag: m.user?.username,
    })).filter(m => m.id);

    // Fetch Subtasks
    const { data: subtasks = [] } = useQuery({
        queryKey: ['subtasks', task?.id],
        queryFn: () => collaborationApi.tasks.getSubtasks(task?.id),
        enabled: !!task?.id,
    });

    // Fetch Comments
    const { data: comments = [] } = useQuery({
        queryKey: ['task_comments', task?.id],
        queryFn: () => collaborationApi.taskComments.list(task?.id),
        enabled: !!task?.id,
    });

    // Subtask Mutations
    const subtaskMutation = useMutation({
        mutationFn: (data) => collaborationApi.tasks.createSubtask({ ...data, task_id: task.id }),
        onSuccess: () => {
            queryClient.invalidateQueries(['subtasks', task.id]);
            queryClient.invalidateQueries(['tasks']);
            setSubtaskInput('');
        }
    });

    const toggleSubtaskMutation = useMutation({
        mutationFn: ({ id, is_completed }) => collaborationApi.tasks.updateSubtask(id, { is_completed }),
        onSuccess: () => {
            queryClient.invalidateQueries(['subtasks', task.id]);
            queryClient.invalidateQueries(['tasks']);
        }
    });

    // Task Update Mutation
    const updateTaskMutation = useMutation({
        mutationFn: ({ id, data }) => collaborationApi.tasks.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['tasks']);
            queryClient.invalidateQueries(['project-tasks']);
        }
    });

    // Attachment Mutation
    const attachmentMutation = useMutation({
        mutationFn: (attachments) => collaborationApi.tasks.update(task.id, { attachments }),
        onSuccess: () => {
            queryClient.invalidateQueries(['tasks']);
        }
    });

    // Comment Mutations
    const commentMutation = useMutation({
        mutationFn: (data) => collaborationApi.taskComments.create({ ...data, task_id: task.id }),
        onSuccess: () => {
            queryClient.invalidateQueries(['task_comments', task.id]);
            queryClient.invalidateQueries(['tasks']);
            setCommentInput('');
            setReplyTo(null);
        }
    });

    const reactionMutation = useMutation({
        mutationFn: ({ commentId, reactions }) => collaborationApi.taskComments.update(commentId, { reactions }),
        onSuccess: () => queryClient.invalidateQueries(['task_comments', task.id])
    });

    const deleteCommentMutation = useMutation({
        mutationFn: (id) => collaborationApi.taskComments.delete(id),
        onSuccess: () => queryClient.invalidateQueries(['task_comments', task.id])
    });

    const handleSubtaskDragEnd = (result) => {
        if (!result.destination) return;

        const items = Array.from(subtasks);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        queryClient.setQueryData(['subtasks', task.id], items);
    };

    if (!task) return null;

    const progress = subtasks.length > 0
        ? Math.round((subtasks.filter(s => s.is_completed).length / subtasks.length) * 100)
        : 0;

    const currentUserId = String(user?.id || user?.user?.id || '').toLowerCase();
    const taskCreatorId = String(task.creator_id || task.user_id || '').toLowerCase();
    const taskAssigneeId = String(task.assignee_id || task.assigned_to || '').toLowerCase();

    const isCreator = currentUserId === taskCreatorId;
    const isAssignee = currentUserId === taskAssigneeId;

    const hasValidAssignee = taskAssigneeId !== '' && taskAssigneeId !== 'null';
    const canChangeStatus = hasValidAssignee ? isAssignee : isCreator;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:max-w-2xl p-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden flex flex-col">
                <div className="sr-only">
                    <h2>Task Details</h2>
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!canChangeStatus}
                                    className="h-8 px-2 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-900"
                                >
                                    <Badge className={cn(
                                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                                        task.status === 'DONE' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" :
                                            task.status === 'IN_PROGRESS' ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" :
                                                "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                    )}>
                                        {task.status.replace('_', ' ')}
                                    </Badge>
                                    {canChangeStatus && <ChevronDown className="w-3 h-3 text-slate-400" />}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: 'TODO' } })}>
                                    <Circle className="w-4 h-4 mr-2" /> Mark as Todo
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: 'IN_PROGRESS' } })}>
                                    <ArrowUpCircle className="w-4 h-4 mr-2" /> Mark In Progress
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: 'DONE' } })}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Done
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                onEdit?.(task);
                                onClose();
                            }}
                            className="h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-900"
                        >
                            <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                onDelete?.(task);
                                onClose();
                            }}
                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-900">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <ScrollArea className="flex-1 min-h-0">
                    <div className="p-6 space-y-6">
                        {/* Title */}
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {task.title}
                        </h1>

                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {task.tags.map((tag, idx) => (
                                    <Badge
                                        key={tag}
                                        className={cn(
                                            "px-3 py-1 text-xs font-semibold rounded-md",
                                            idx === 0
                                                ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                                                : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                        )}
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {/* Metadata */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-900">
                                <span className="text-sm font-medium text-slate-500">Assignee</span>
                                <div className="flex items-center gap-2">
                                    {task.team_id ? (
                                        <CollaboratorPreview teamId={task.team_id} size="sm" />
                                    ) : (
                                        <Avatar className="h-7 w-7">
                                            <AvatarFallback className="bg-slate-900 text-white text-xs">U</AvatarFallback>
                                        </Avatar>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                        <Plus className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-900">
                                <span className="text-sm font-medium text-slate-500">Due Date</span>
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    <Calendar className="w-4 h-4" />
                                    {task.due_date ? formatDate(task.due_date) : 'No date set'}
                                </div>
                            </div>

                            {/* Attachments */}
                            <div className="py-3 border-b border-slate-100 dark:border-slate-900">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                        <Paperclip className="w-4 h-4" /> Attachments
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-zinc-400"
                                        onClick={() => {
                                            const url = prompt('Enter image/file URL:');
                                            if (url) {
                                                const newAttachments = [...(task.attachments || []), { name: url.split('/').pop(), url }];
                                                attachmentMutation.mutate(newAttachments);
                                            }
                                        }}
                                    >
                                        Add
                                    </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {task.attachments?.map((att, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                            <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                                <Paperclip className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate text-slate-900 dark:text-white">{att.name}</p>
                                                <a href={att.url} target="_blank" rel="noreferrer" className="text-[10px] text-zinc-400 hover:underline">View</a>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-slate-400 hover:text-red-500"
                                                onClick={() => {
                                                    const newAttachments = task.attachments.filter((_, i) => i !== idx);
                                                    attachmentMutation.mutate(newAttachments);
                                                }}
                                            >
                                                <X className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        {task.description && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Description</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {task.description}
                                </p>
                            </div>
                        )}

                        {/* Tabs */}
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="w-full justify-start border-b border-slate-200 dark:border-slate-800 bg-transparent rounded-none p-0 h-auto">
                                <TabsTrigger
                                    value="progress"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-white data-[state=active]:bg-transparent px-4 py-3"
                                >
                                    <span className="font-semibold">Progress</span>
                                    {subtasks.length > 0 && (
                                        <Badge variant="secondary" className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                            {progress}%
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="comments"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-white data-[state=active]:bg-transparent px-4 py-3"
                                >
                                    <span className="font-semibold">Comments</span>
                                    {comments.length > 0 && (
                                        <Badge className="ml-2 bg-zinc-800 text-zinc-300 dark:bg-zinc-700">
                                            {comments.length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="progress" className="mt-6 space-y-4">
                                {/* Progress Bar */}
                                {subtasks.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-600 dark:text-slate-400">
                                                {subtasks.filter(s => s.is_completed).length} of {subtasks.length} completed
                                            </span>
                                            <span className="font-bold text-slate-900 dark:text-white">{progress}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                className="h-full bg-emerald-500 rounded-full"
                                                transition={{ duration: 0.3 }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Subtasks List */}
                                <DragDropContext onDragEnd={handleSubtaskDragEnd}>
                                    <Droppable droppableId="subtasks">
                                        {(provided) => (
                                            <div
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className="space-y-2"
                                            >
                                                {subtasks.map((sub, index) => (
                                                    <Draggable key={sub.id} draggableId={sub.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={cn(
                                                                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                                                                    snapshot.isDragging
                                                                        ? "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 shadow-lg"
                                                                        : "bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                                                                )}
                                                            >
                                                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                                                    <GripVertical className="w-4 h-4 text-slate-400" />
                                                                </div>
                                                                <button
                                                                    onClick={() => toggleSubtaskMutation.mutate({ id: sub.id, is_completed: !sub.is_completed })}
                                                                    className="transition-transform active:scale-90"
                                                                >
                                                                    {sub.is_completed ? (
                                                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                                    ) : (
                                                                        <Circle className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                                                                    )}
                                                                </button>
                                                                <span className={cn(
                                                                    "flex-1 text-sm font-medium",
                                                                    sub.is_completed
                                                                        ? "text-slate-400 line-through"
                                                                        : "text-slate-900 dark:text-slate-100"
                                                                )}>
                                                                    {sub.title}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}

                                                {/* Add Subtask Input */}
                                                <div className="flex items-center gap-3 p-3">
                                                    <Circle className="w-5 h-5 text-slate-200 dark:text-slate-800" />
                                                    <Input
                                                        placeholder="Add a subtask..."
                                                        value={subtaskInput}
                                                        onChange={(e) => setSubtaskInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && subtaskInput.trim()) {
                                                                subtaskMutation.mutate({ title: subtaskInput });
                                                            }
                                                        }}
                                                        className="border-none bg-transparent focus-visible:ring-0 text-sm font-medium"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                            </TabsContent>

                            <TabsContent value="comments" className="mt-6 space-y-6">
                                {comments.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400">
                                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p className="text-sm font-medium">No comments yet</p>
                                        <p className="text-xs mt-1">Be the first to comment</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {comments.filter(c => !c.parent_id).map((comment) => (
                                            <CommentItem
                                                key={comment.id}
                                                comment={comment}
                                                replies={comments.filter(r => r.parent_id === comment.id)}
                                                onReply={(c) => setReplyTo(c)}
                                                onReact={(id, reactions) => reactionMutation.mutate({ commentId: id, reactions })}
                                                onDelete={(id) => deleteCommentMutation.mutate(id)}
                                                currentUserId={user?.id || user?.user?.id}
                                            />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </ScrollArea>

                {/* Comment Input Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 relative">
                    {replyTo && (
                        <div className="mb-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border-l-2 border-zinc-400 dark:border-zinc-600 flex items-center justify-between rounded-r-lg">
                            <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                                Replying to <span className="font-bold">Team Member</span>
                            </span>
                            <Button variant="ghost" size="icon" className="h-4 w-4 text-zinc-400" onClick={() => setReplyTo(null)}>
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    )}

                    {showTagList && teamMembers.length > 0 && (
                        <div className="absolute bottom-full left-4 mb-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden z-50">
                            {teamMembers.map(member => (
                                <button
                                    key={member.id}
                                    className="w-full px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                                    onClick={() => {
                                        const parts = commentInput.split('@');
                                        parts.pop();
                                        setCommentInput(parts.join('@') + `@${member.user_tag || member.id} `);
                                        setShowTagList(false);
                                    }}
                                >
                                    <Avatar className="h-5 w-5">
                                        <AvatarFallback className="bg-slate-200 text-[8px] font-bold uppercase">{member.display_name?.charAt(0) || 'U'}</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate">{member.display_name || member.user_tag || 'User'}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800 focus-within:ring-2 focus-within:ring-white/15">
                        <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-zinc-800 text-zinc-100 text-xs font-bold">ME</AvatarFallback>
                        </Avatar>
                        <Input
                            placeholder="Add a comment... Use @ to tag"
                            value={commentInput}
                            onChange={(e) => {
                                setCommentInput(e.target.value);
                                if (e.target.value.endsWith('@')) {
                                    setShowTagList(true);
                                } else if (!e.target.value.includes('@')) {
                                    setShowTagList(false);
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && commentInput.trim()) {
                                    commentMutation.mutate({ content: commentInput, parent_id: replyTo?.id });
                                }
                            }}
                            className="flex-1 border-none bg-transparent focus-visible:ring-0 text-sm"
                        />
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                                <Smile className="w-4 h-4" />
                            </Button>
                            <Button
                                onClick={() => commentInput.trim() && commentMutation.mutate({ content: commentInput, parent_id: replyTo?.id })}
                                disabled={!commentInput.trim() || commentMutation.isPending}
                                size="icon"
                                className="h-8 w-8 bg-zinc-900 hover:bg-zinc-700 dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 disabled:opacity-50"
                            >
                                <Send className="w-4 h-4 text-white" />
                            </Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// Helper Comment Item Component
function CommentItem({ comment, replies, onReply, onReact, onDelete, currentUserId, isReply = false }) {
    const isOwner = String(comment.user_id).toLowerCase() === String(currentUserId).toLowerCase();

    return (
        <div className={cn("flex gap-3", isReply && "ml-12")}>
            <Avatar className={cn("shrink-0", isReply ? "h-7 w-7" : "h-9 w-9")}>
                {comment.user?.avatar_url ? (
                    <img src={comment.user.avatar_url} alt={comment.user.username} className="rounded-full object-cover" />
                ) : (
                    <AvatarFallback className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase">
                        {(comment.user?.username || comment.user_id || 'U').charAt(0)}
                    </AvatarFallback>
                )}
            </Avatar>
            <div className="flex-1 min-w-0 group/comment">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-3 inline-block max-w-full">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] font-bold text-slate-900 dark:text-white">
                            {comment.user?.username || 'User'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{formatDate(comment.created_at, 'time')}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {comment.content.split(/(@\w+)/g).map((part, i) =>
                            part.startsWith('@')
                                ? <span key={i} className="text-zinc-200 font-semibold cursor-pointer hover:underline">{part}</span>
                                : part
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-3 mt-1.5 px-1">
                    <button
                        onClick={() => onReact(comment.id, [...(comment.reactions || []), '❤️'])}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <Heart className={cn("w-3.5 h-3.5", comment.reactions?.length > 0 && "fill-red-500 text-red-500")} />
                        {comment.reactions?.length > 0 && comment.reactions.length}
                    </button>
                    {!isReply && (
                        <button
                            onClick={() => onReply(comment)}
                            className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-zinc-200 transition-colors"
                        >
                            <Reply className="w-3.5 h-3.5" /> Reply
                        </button>
                    )}
                    {isOwner && (
                        <button
                            onClick={() => onDelete(comment.id)}
                            className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover/comment:opacity-100"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                    )}
                </div>

                {replies?.length > 0 && (
                    <div className="mt-4 space-y-4">
                        {replies.map(reply => (
                            <CommentItem
                                key={reply.id}
                                comment={reply}
                                onReact={onReact}
                                onDelete={onDelete}
                                currentUserId={currentUserId}
                                isReply={true}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}