'use client';

import React, { useState, useEffect } from 'react';

import {
    X, Maximize2, Minimize2, ChevronsLeftRight, Plus, Users,
    GripVertical, Network, UserPlus, Calendar, Trash2, ChevronDown, ChevronRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useChannelMembers } from '@/hooks/use-channels';
import { useProjectMembers } from '@/hooks/use-projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Lora } from 'next/font/google';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

const lora = Lora({
    subsets: ['latin'],
    variable: '--font-lora',
});

const MilestoneItemForm = ({
    m,
    index,
    onUpdate,
    onDelete,
    teamMembers,
    isTeamGoal
}) => {
    const [showDates, setShowDates] = useState(!!(m.start_date || m.end_date));
    const [isExpanded, setIsExpanded] = useState(true);
    const [popoverOpen, setPopoverOpen] = useState(false);

    const handleAddSub = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = e.target.value.trim();
            if (val) {
                const sub = { id: crypto.randomUUID(), title: val, completed: false };
                onUpdate({ subMilestones: [...(m.subMilestones || []), sub] });
                e.target.value = '';
            }
        }
    };

    const toggleSub = (subIdx) => {
        const subs = [...(m.subMilestones || [])];
        subs[subIdx].completed = !subs[subIdx].completed;
        onUpdate({ subMilestones: subs });
    };

    const removeSub = (subIdx) => {
        const subs = [...(m.subMilestones || [])];
        subs.splice(subIdx, 1);
        onUpdate({ subMilestones: subs });
    };

    const assignedMember = (teamMembers || []).find(member => (member.user?.id || member.user_id) === m.assigned_to);

    return (
        <Draggable draggableId={m.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                        "group bg-[#fcfcfd] dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl transition-all duration-300 mb-4 overflow-hidden shadow-sm",
                        snapshot.isDragging ? "shadow-xl ring-1 ring-slate-200 dark:ring-slate-700" : "hover:border-slate-300"
                    )}
                >
                    <div className="p-4 space-y-4">
                        <div className="flex items-center gap-3">
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors">
                                <GripVertical className="w-4 h-4" />
                            </div>

                            <Checkbox
                                checked={m.completed}
                                onCheckedChange={(checked) => onUpdate({ completed: checked })}
                                className="h-4 w-4 rounded-sm border-slate-300 dark:border-slate-700 data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900 dark:data-[state=checked]:bg-slate-100 dark:data-[state=checked]:border-slate-100"
                            />

                            <Input
                                value={m.title}
                                onChange={(e) => onUpdate({ title: e.target.value })}
                                className={cn(
                                    "h-8 border-none bg-transparent hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-[13px] font-semibold p-0 px-2 transition-colors flex-1",
                                    m.completed ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-200"
                                )}
                                placeholder="Milestone objective..."
                            />

                            <div className="flex items-center gap-1">
                                {isTeamGoal && (
                                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className={cn(
                                                    "h-8 w-8 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
                                                    m.assigned_to && "text-indigo-600 bg-indigo-50/50"
                                                )}
                                                title="Assign milestone"
                                            >
                                                <UserPlus className="w-3.5 h-3.5" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-48 p-1 border-slate-200 dark:border-slate-800" align="end">
                                            {(teamMembers || []).map(member => {
                                                const mUserId = member.user?.id || member.user_id;
                                                const mUsername = member.user?.username || member.user_tag || 'member';
                                                return (                                                    <Button
                                                        key={mUserId}
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            onUpdate({ assigned_to: mUserId === m.assigned_to ? null : mUserId });
                                                            setPopoverOpen(false);
                                                        }}
                                                        className={cn(
                                                            "w-full justify-start text-[11px] font-semibold h-8 rounded-md px-2",
                                                            m.assigned_to === mUserId ? "bg-slate-100 text-slate-900" : "text-slate-600"
                                                        )}
                                                    >
                                                        @{mUsername}
                                                    </Button>
                                                );
                                            })}
                                        </PopoverContent>
                                    </Popover>
                                )}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setShowDates(!showDates)}
                                        className={cn(
                                            "h-8 w-8 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
                                            showDates && "text-slate-900 bg-slate-100"
                                        )}
                                    >
                                        <Calendar className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsExpanded(!isExpanded)}
                                        className="h-8 w-8 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={onDelete}
                                        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-transparent"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {m.assigned_to && assignedMember && (
                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 border-none text-[9px] font-black uppercase tracking-wider py-0 px-2 rounded-full">
                                @{assignedMember.user?.username || assignedMember.user_tag || 'member'}
                            </Badge>
                        )}

                        {showDates && (
                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase tracking-wider font-black text-slate-400">Start Date</Label>
                                    <Input
                                        type="date"
                                        value={m.start_date || ''}
                                        onChange={(e) => onUpdate({ start_date: e.target.value })}
                                        className="h-8 text-xs rounded-lg border-slate-100 dark:border-slate-800"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase tracking-wider font-black text-slate-400">End Date</Label>
                                    <Input
                                        type="date"
                                        value={m.end_date || ''}
                                        onChange={(e) => onUpdate({ end_date: e.target.value })}
                                        className="h-8 text-xs rounded-lg border-slate-100 dark:border-slate-800"
                                    />
                                </div>
                            </div>
                        )}

                        {isExpanded && (
                            <Droppable droppableId={`sub-${m.id}`} type="subMilestones">
                                {(subProvided) => (
                                    <div
                                        {...subProvided.droppableProps}
                                        ref={subProvided.innerRef}
                                        className="space-y-2 pt-2 border-t border-slate-50 dark:border-slate-800/50"
                                    >
                                        {(m.subMilestones || []).map((sub, sIdx) => (
                                            <Draggable key={sub.id} draggableId={sub.id} index={sIdx}>
                                                {(sProvided, sSnapshot) => (
                                                    <div
                                                        ref={sProvided.innerRef}
                                                        {...sProvided.draggableProps}
                                                        className={cn(
                                                            "group/sub flex flex-col gap-2 pl-2 pr-2 py-2 rounded-xl transition-all",
                                                            sSnapshot.isDragging ? "bg-slate-50 dark:bg-slate-800 shadow-lg ring-1 ring-slate-200 dark:ring-slate-700" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div {...sProvided.dragHandleProps} className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing">
                                                                <GripVertical className="w-3.5 h-3.5" />
                                                            </div>
                                                            <Checkbox
                                                                checked={sub.completed}
                                                                onCheckedChange={() => toggleSub(sIdx)}
                                                                className="h-4 w-4"
                                                            />
                                                            <Input
                                                                value={sub.title}
                                                                onChange={(e) => {
                                                                    const subs = [...m.subMilestones];
                                                                    subs[sIdx].title = e.target.value;
                                                                    onUpdate({ subMilestones: subs });
                                                                }}
                                                                className="h-7 border-none bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-[13px] p-0 px-2 transition-colors flex-1"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    removeSub(sIdx);
                                                                }}
                                                                className="h-6 w-6 opacity-0 group-hover/sub:opacity-100 text-slate-300 hover:text-red-500"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </Button>
                                                        </div>

                                                        <div className="flex items-center gap-4 pl-8">
                                                            <div className="flex items-center gap-2">
                                                                <Label className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">From</Label>
                                                                <Input
                                                                    type="date"
                                                                    value={sub.start_date || ''}
                                                                    min={m.start_date || undefined}
                                                                    max={sub.end_date || m.end_date || undefined}
                                                                    onChange={(e) => {
                                                                        const subs = [...m.subMilestones];
                                                                        subs[sIdx].start_date = e.target.value;
                                                                        onUpdate({ subMilestones: subs });
                                                                    }}
                                                                    className="h-6 w-28 text-[11px] px-1.5 rounded-md border-slate-100 dark:border-slate-800"
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Label className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">To</Label>
                                                                <Input
                                                                    type="date"
                                                                    value={sub.end_date || ''}
                                                                    min={sub.start_date || m.start_date || undefined}
                                                                    max={m.end_date || undefined}
                                                                    onChange={(e) => {
                                                                        const subs = [...m.subMilestones];
                                                                        subs[sIdx].end_date = e.target.value;
                                                                        onUpdate({ subMilestones: subs });
                                                                    }}
                                                                    className="h-6 w-28 text-[11px] px-1.5 rounded-md border-slate-100 dark:border-slate-800"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {subProvided.placeholder}
                                        <div className="flex items-center gap-2 pl-4">
                                            <div className="w-4 h-4 flex items-center justify-center text-slate-300">
                                                <Plus className="w-3 h-3" />
                                            </div>
                                            <Input
                                                placeholder="Add sub-milestone..."
                                                onKeyDown={handleAddSub}
                                                className="h-7 border-none bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-[12px] italic p-0 px-2 transition-colors"
                                            />
                                        </div>
                                    </div>
                                )}
                            </Droppable>
                        )}
                    </div>
                </div>
            )}
        </Draggable>
    );
};

export default function GoalForm({ open, onClose, onSubmit, goal, isLoading }) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'personal',
        status: 'not_started',
        priority: 'medium',
        target_date: '',
        progress: 0,
        milestones: [],
    });
    const [newMilestone, setNewMilestone] = useState('');
    const [viewMode, setViewMode] = useState('default');

    const channelId = goal?.channel_id || goal?.group_id; // Try to resolve channel/group ID
    const projectId = goal?.project_id;
    
    const { data: channelMembers = [] } = useChannelMembers(channelId);
    const { data: projectMembers = [] } = useProjectMembers(projectId);

    const teamMembers = projectId ? projectMembers : channelMembers;

    const ensureIds = (milestones) => {
        if (!milestones) return [];
        return milestones.map(m => ({
            ...m,
            id: m.id || crypto.randomUUID(),
            subMilestones: (m.subMilestones || []).map(s => ({
                ...s,
                id: s.id || crypto.randomUUID()
            }))
        }));
    };

    useEffect(() => {
        if (!open) setViewMode('default');
    }, [open]);

    const getViewClass = () => {
        switch (viewMode) {
            case 'full': return 'sm:max-w-full sm:w-full';
            case 'large': return 'sm:max-w-4xl';
            default: return 'sm:max-w-2xl';
        }
    };

    useEffect(() => {
        if (goal) {
            setFormData({
                title: goal.title || '',
                description: goal.description || '',
                category: goal.category || 'personal',
                status: goal.status || 'not_started',
                priority: goal.priority || 'medium',
                target_date: goal.target_date || '',
                progress: goal.progress || 0,
                milestones: ensureIds(goal.milestones || []),
                channel_id: goal.channel_id,
                project_id: goal.project_id,
                team_id: goal.team_id,
            });
        } else {
            setFormData({
                title: '',
                description: '',
                category: 'personal',
                status: 'not_started',
                priority: 'medium',
                target_date: '',
                progress: 0,
                milestones: [],
                channel_id: null,
                project_id: null,
                team_id: null,
            });
        }
    }, [goal, open]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const calculateProgress = (milestones) => {
        if (!milestones || milestones.length === 0) return 0;
        const rootWeight = 100 / milestones.length;
        let total = 0;
        milestones.forEach(m => {
            if (m.subMilestones && m.subMilestones.length > 0) {
                const completedSubs = m.subMilestones.filter(s => s.completed).length;
                total += (completedSubs / m.subMilestones.length) * rootWeight;
            } else {
                total += m.completed ? rootWeight : 0;
            }
        });
        return Math.round(total);
    };

    const reorder = (list, startIndex, endIndex) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };

    const handleDragEnd = (result) => {
        if (!result.destination) return;

        const { source, destination, type } = result;

        if (type === 'milestones') {
            const items = reorder(formData.milestones, source.index, destination.index);
            setFormData({ ...formData, milestones: items });
        } else if (type === 'subMilestones') {
            const milestoneId = source.droppableId.replace('sub-', '');
            const milestones = [...formData.milestones];
            const mIdx = milestones.findIndex(m => m.id === milestoneId);

            if (mIdx !== -1) {
                const subMilestones = reorder(milestones[mIdx].subMilestones, source.index, destination.index);
                milestones[mIdx] = { ...milestones[mIdx], subMilestones };
                setFormData({ ...formData, milestones });
            }
        }
    };

    const addMilestone = () => {
        if (newMilestone.trim()) {
            const newItem = {
                id: crypto.randomUUID(),
                title: newMilestone,
                completed: false,
                assigned_to: null,
                start_date: '',
                end_date: '',
                subMilestones: []
            };
            const updatedMilestones = [...(formData.milestones || []), newItem];
            setFormData({
                ...formData,
                milestones: updatedMilestones,
                progress: calculateProgress(updatedMilestones)
            });
            setNewMilestone('');
        }
    };

    const updateMilestone = (idx, data) => {
        const updated = [...formData.milestones];
        updated[idx] = { ...updated[idx], ...data };
        setFormData({
            ...formData,
            milestones: updated,
            progress: calculateProgress(updated)
        });
    };

    const removeMilestone = (idx) => {
        const updated = [...formData.milestones];
        updated.splice(idx, 1);
        setFormData({
            ...formData,
            milestones: updated,
            progress: calculateProgress(updated)
        });
    };

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent className={`${getViewClass()} w-full p-0 flex flex-col border-none bg-white dark:bg-slate-900 transition-all duration-500 ${lora.variable}`}>
                <SheetHeader className="p-6 pb-2 space-y-4 text-left border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                            {goal ? 'Edit Goal' : 'Create Goal'}
                        </SheetTitle>
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
                <form onSubmit={handleSubmit} className="space-y-6 flex-1 overflow-y-auto px-6 py-6">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Title</Label>
                        <Input
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                            className="rounded-xl h-11"
                            placeholder="e.g., Master React Native"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Description</Label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                            className="rounded-xl resize-none"
                            placeholder="Define your success criteria..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-x-2">
                            <Label className="text-sm font-medium">Category</Label>
                            <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="personal">Personal</SelectItem>
                                    <SelectItem value="career">Career</SelectItem>
                                    <SelectItem value="health">Health</SelectItem>
                                    <SelectItem value="financial">Financial</SelectItem>
                                    <SelectItem value="learning">Learning</SelectItem>
                                    <SelectItem value="relationships">Relationships</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-x-2">
                            <Label className="text-sm font-medium">Priority</Label>
                            <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Target Date</Label>
                            <Input type="date" value={formData.target_date} onChange={(e) => setFormData({ ...formData, target_date: e.target.value })} className="rounded-xl h-11" />
                        </div>
                        <div className="space-x-2">
                            <Label className="text-sm font-medium">Status</Label>
                            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TODO">Not Started</SelectItem>
                                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                    <SelectItem value="DONE">Completed</SelectItem>
                                    <SelectItem value="ABANDONED">Abandoned</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <Plus className="w-4 h-4 text-slate-400" />
                                Key Milestones
                            </Label>
                            <Badge variant="secondary" className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 border-none">
                                {formData.milestones?.length || 0} Phases
                            </Badge>
                        </div>

                        <div className="flex gap-2">
                            <Input
                                placeholder="Fast add milestone..."
                                value={newMilestone}
                                onChange={(e) => setNewMilestone(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMilestone())}
                                className="rounded-xl h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                            />
                            <Button
                                type="button"
                                onClick={addMilestone}
                                className="rounded-xl px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 h-11 border-none transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>

                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="milestones">
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="space-y-3 min-h-[50px] transition-all"
                                    >
                                        {formData.milestones?.length === 0 && (
                                            <div className="py-8 text-center space-y-2">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
                                                    <GripVertical className="w-5 h-5 text-slate-300" />
                                                </div>
                                                <p className="text-xs text-slate-400 font-medium">No milestones added yet.<br />Break down your goal into small steps.</p>
                                            </div>
                                        )}
                                        {formData.milestones?.map((m, idx) => (
                                            <MilestoneItemForm
                                                key={m.id}
                                                m={m}
                                                index={idx}
                                                isTeamGoal={!!formData.team_id || !!formData.channel_id || !!formData.project_id}
                                                teamMembers={teamMembers}
                                                onUpdate={(data) => updateMilestone(idx, data)}
                                                onDelete={() => removeMilestone(idx)}
                                            />
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </div>
                    <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center justify-end gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                className="h-10 px-6 rounded-xl font-semibold text-slate-500 hover:text-slate-700"
                            >
                                Dismiss
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoading || !formData.title}
                                className="h-10 px-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold shadow-sm transition-all hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50"
                            >
                                {isLoading ? 'Saving...' : goal ? 'Update Objective' : 'Deploy Goal'}
                            </Button>
                        </div>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
