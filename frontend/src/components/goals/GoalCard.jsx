import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collaborationApi } from '@/lib/collaboration-api';
import { channelsApi } from '@/lib/channels-api';
import {
    MoreVertical, Edit, Trash2, BarChart2, Plus,
    CheckCircle2, Heart, Pencil, GripVertical, Network, X,
    ChevronDown, ChevronRight, Calendar, Users, User, UserPlus, Shield
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useSound } from '@/hooks/useSound';
import { CollaboratorPreview } from '@/components/shared/CollaboratorPreview';

// --- Utility Functions ---

const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? 'Invalid Date' : format(date, 'MMM d, yyyy');
};

const NOTE_COLORS = [
    { name: 'slate', value: 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800' },
    { name: 'amber', value: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' },
    { name: 'blue', value: 'bg-zinc-50 border-zinc-200 dark:bg-zinc-900/30 dark:border-zinc-700' },
    { name: 'green', value: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' },
    { name: 'rose', value: 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800' },
    { name: 'indigo', value: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' },
];

const statusColors = {
    TODO: 'bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-500',
    IN_PROGRESS: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    DONE: 'bg-emerald-50/50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-500',
    ABANDONED: 'bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-600',
};

const categoryColors = {
    personal: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    career: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    health: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    financial: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    learning: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    relationships: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

// Ensure every item has a unique ID for drag and drop
const ensureIds = (milestones) => {
    if (!milestones) return [];
    return milestones.map(m => {
        const id = m.id || crypto.randomUUID();
        return {
            ...m,
            id,
            subMilestones: (m.subMilestones || []).map(s => ({
                ...s,
                id: s.id || crypto.randomUUID()
            }))
        };
    });
};

const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
};

// --- Sub-components ---

const SubMilestoneItem = ({ sub, index, onToggle, onDelete, canToggle, teamMembers, onAssign, isTeamGoal, canAssign }) => {
    const assignedMember = isTeamGoal && sub.assigned_to
        ? (teamMembers || []).find(member => (member.user?.id || member.user_id) === sub.assigned_to)
        : null;

    return (
        <Draggable draggableId={sub.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                        "relative flex flex-col gap-1 pl-3 py-1 group/sub transition-all duration-200",
                        snapshot.isDragging
                            ? "bg-slate-50 dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 z-50 rounded-lg"
                            : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    )}
                    style={{
                        ...provided.draggableProps.style,
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            {...provided.dragHandleProps}
                            className={cn(
                                "opacity-0 group-hover/sub:opacity-100 p-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-opacity"
                            )}
                        >
                            <GripVertical className="w-3 h-3" />
                        </div>

                        <Checkbox
                            className={cn(
                                "h-3 w-3 rounded-sm border-slate-300 dark:border-slate-700 data-[state=checked]:bg-slate-700 dark:data-[state=checked]:bg-slate-300 data-[state=checked]:border-slate-700 dark:data-[state=checked]:border-slate-300",
                                !canToggle && "opacity-50 cursor-not-allowed"
                            )}
                            checked={sub.completed}
                            onCheckedChange={(checked) => canToggle && onToggle(checked)}
                            disabled={!canToggle}
                        />

                        <span className={cn(
                            "flex-1 text-[12px] font-semibold transition-colors select-none",
                            sub.completed ? "text-slate-400 line-through" : "text-slate-600 dark:text-slate-400"
                        )}>
                            {sub.title}
                        </span>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity pr-1">
                            {isTeamGoal && canAssign && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600">
                                            <UserPlus className="w-3 h-3" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-1 border-slate-200 dark:border-slate-800" align="end">
                                        {(teamMembers || []).map(member => {
                                            const mUserId = member.user?.id || member.user_id;
                                            const mUsername = member.user?.username || member.user_tag || 'member';
                                            return (
                                                <Button
                                                    key={mUserId}
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onAssign(mUserId)}
                                                    className={cn(
                                                        "w-full justify-start text-[11px] font-semibold h-8 rounded-md px-2",
                                                        sub.assigned_to === mUserId ? "bg-slate-100 text-slate-900" : "text-slate-600"
                                                    )}
                                                >
                                                    @{mUsername}
                                                </Button>
                                            );
                                        })}
                                    </PopoverContent>
                                </Popover>
                            )}

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                className="h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-transparent"
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                    {assignedMember && (
                        <div className="ml-9 mb-1">
                            <span className="text-[10px] font-bold text-indigo-500/80 dark:text-indigo-400/80 flex items-center gap-1 transition-colors uppercase tracking-wider">
                                <User className="w-2.5 h-2.5" />
                                {assignedMember.user?.username || assignedMember.user_tag || 'assigned'}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </Draggable>
    );
};

const MilestoneItem = ({
    m,
    index,
    goal,
    onUpdate,
    onCreateTaskFromMilestone,
    calculateProgressForUpdate,
    updateLocalMilestones,
    localList,
    teamMembers,
    user,
    currentMembership
}) => {
    const playSuccessSound = useSound('/sounds/complete.mp3');
    const [isExpanded, setIsExpanded] = useState(true);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const hasSubMilestones = m.subMilestones && m.subMilestones.length > 0;
    const isTeamGoal = !!goal.team_id || !!goal.channel_id;
    const isGoalOwner = goal.user_id === user?.id;
    const isChannelAdmin = currentMembership?.role === 'OWNER' || currentMembership?.role === 'ADMIN' || currentMembership?.role === 'owner' || currentMembership?.role === 'admin';
    const canAssign = isGoalOwner || isChannelAdmin;
    const isAssigned = m.assigned_to === user?.id;
    const canToggle = !isTeamGoal || isChannelAdmin || isAssigned || !m.assigned_to || isGoalOwner;

    const assignedMember = isTeamGoal && m.assigned_to
        ? (teamMembers || []).find(member => (member.user?.id || member.user_id) === m.assigned_to)
        : null;

    const handleAssign = (userId) => {
        if (!canAssign) return;
        const newList = [...localList];
        const itemIndex = newList.findIndex(item => item.id === m.id);
        if (itemIndex === -1) return;

        newList[itemIndex] = { ...newList[itemIndex], assigned_to: userId === m.assigned_to ? null : userId };
        updateLocalMilestones(newList);
        onUpdate({ id: goal.id, data: { milestones: newList } });
    };

    const handleToggle = (checked) => {
        if (checked && typeof playSuccessSound === 'function') {
            try {
                playSuccessSound();
            } catch (e) {
                console.error("Failed to play sound", e);
            }
        }
        const newList = [...localList];
        const itemIndex = newList.findIndex(item => item.id === m.id);
        if (itemIndex === -1) return;

        newList[itemIndex] = { ...newList[itemIndex], completed: checked };

        // Sync: Parent -> Children
        if (newList[itemIndex].subMilestones) {
            newList[itemIndex].subMilestones = newList[itemIndex].subMilestones.map(s => ({ ...s, completed: checked }));
        }

        updateLocalMilestones(newList);

        // Trigger update to parent
        const newProgress = calculateProgressForUpdate(newList);
        onUpdate({ id: goal.id, data: { milestones: newList, progress: newProgress } });
    };

    const handleSubToggle = (subIndex, checked) => {
        if (!canToggle) return;
        if (checked && typeof playSuccessSound === 'function') {
            try {
                playSuccessSound();
            } catch (e) {
                console.error("Failed to play sound", e);
            }
        }
        const newList = [...localList];
        const itemIndex = newList.findIndex(item => item.id === m.id);
        if (itemIndex === -1) return;

        const subs = [...newList[itemIndex].subMilestones];
        subs[subIndex] = { ...subs[subIndex], completed: checked };
        newList[itemIndex].subMilestones = subs;

        // Sync: Children -> Parent
        const allSubsCompleted = subs.every(s => s.completed);
        newList[itemIndex].completed = allSubsCompleted;

        updateLocalMilestones(newList);

        // Trigger update to parent
        const newProgress = calculateProgressForUpdate(newList);
        onUpdate({ id: goal.id, data: { milestones: newList, progress: newProgress } });
    };

    const handleSubAssign = (subIndex, userId) => {
        if (!canAssign) return;
        const newList = [...localList];
        const itemIndex = newList.findIndex(item => item.id === m.id);
        if (itemIndex === -1) return;

        const subs = [...newList[itemIndex].subMilestones];
        subs[subIndex] = { 
            ...subs[subIndex], 
            assigned_to: userId === subs[subIndex].assigned_to ? null : userId 
        };
        newList[itemIndex].subMilestones = subs;

        updateLocalMilestones(newList);
        onUpdate({ id: goal.id, data: { milestones: newList } });
    };

    const handleAddSub = (val) => {
        const newList = [...localList];
        const itemIndex = newList.findIndex(item => item.id === m.id);
        if (itemIndex === -1) return;

        if (!newList[itemIndex].subMilestones) newList[itemIndex].subMilestones = [];
        newList[itemIndex].subMilestones.push({ id: crypto.randomUUID(), title: val, completed: false });

        if (newList[itemIndex].completed) {
            newList[itemIndex].completed = false; // Parent not done if new sub added
        }

        updateLocalMilestones(newList);
        setIsExpanded(true);

        const newProgress = calculateProgressForUpdate(newList);
        onUpdate({ id: goal.id, data: { milestones: newList, progress: newProgress } });
    };

    const handleDeleteSub = (subIndex) => {
        const newList = [...localList];
        const itemIndex = newList.findIndex(item => item.id === m.id);
        if (itemIndex === -1) return;

        const subs = newList[itemIndex].subMilestones.filter((_, i) => i !== subIndex);
        newList[itemIndex].subMilestones = subs;

        if (subs.length > 0) {
            newList[itemIndex].completed = subs.every(s => s.completed);
        }

        updateLocalMilestones(newList);

        const newProgress = calculateProgressForUpdate(newList);
        onUpdate({ id: goal.id, data: { milestones: newList, progress: newProgress } });
    };

    const executeDelete = () => {
        const newList = localList.filter(item => item.id !== m.id);
        updateLocalMilestones(newList);

        const newProgress = calculateProgressForUpdate(newList);
        onUpdate({ id: goal.id, data: { milestones: newList, progress: newProgress } });
    };

    const handleDeleteMilestone = () => {
        setIsDeleteOpen(true);
    };

    return (
        <>
            <Draggable draggableId={m.id} index={index}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="mb-1"
                        style={provided.draggableProps.style}
                    >
                        <div className={cn(
                            "group/milestone relative flex items-center justify-between py-2 px-1 rounded-lg transition-all duration-200",
                            snapshot.isDragging
                                ? "bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 z-50"
                                : "hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                        )}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div
                                    {...provided.dragHandleProps}
                                    className={cn(
                                        "opacity-0 group-hover/milestone:opacity-100 p-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-opacity"
                                    )}
                                >
                                    <GripVertical className="w-3.5 h-3.5" />
                                </div>

                                <Checkbox
                                    checked={m.completed}
                                    onCheckedChange={handleToggle}
                                    disabled={!canToggle}
                                    className={cn(
                                        "h-4 w-4 rounded-sm border-slate-300 dark:border-slate-700 data-[state=checked]:bg-slate-900 dark:data-[state=checked]:bg-slate-100 data-[state=checked]:border-slate-900 dark:data-[state=checked]:border-slate-100 transition-colors",
                                        !canToggle && "opacity-50 cursor-not-allowed"
                                    )}
                                />

                                <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={cn(
                                                "text-[13px] font-semibold transition-all select-none truncate",
                                                m.completed ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-200"
                                            )}
                                        >
                                            {m.title}
                                        </span>
                                        {hasSubMilestones && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                                                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                                            >
                                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                {assignedMember && (
                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 transition-colors">
                                        <User className="w-3 h-3 text-slate-400" />
                                        @{assignedMember.user?.username || assignedMember.user_tag || 'assigned'}
                                    </span>
                                )}
                                {(m.start_date || m.end_date) && (
                                    <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                                        <Calendar className="w-2.5 h-2.5" />
                                        {m.end_date ? formatDate(m.end_date) : 'No date'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover/milestone:opacity-100 transition-opacity pr-1">
                        {isTeamGoal && canAssign && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600">
                                        <UserPlus className="w-3.5 h-3.5" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-1 border-slate-200 dark:border-slate-800" align="end">
                                    {(teamMembers || []).map(member => {
                                        const mUserId = member.user?.id || member.user_id;
                                        const mUsername = member.user?.username || member.user_tag || 'member';
                                        return (
                                            <Button
                                                key={mUserId}
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleAssign(mUserId)}
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
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteMilestone()}
                                    className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-transparent"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>

                        {/* Sub-milestones */}
                        <AnimatePresence>
                            {hasSubMilestones && isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="relative ml-8 pt-1 pb-1">
                                        <div className="absolute left-[-11px] top-0 bottom-4 w-px bg-slate-100 dark:bg-slate-800" />

                                        <Droppable droppableId={`sub-${m.id}`} type="SUB_MILESTONE">
                                            {(provided) => (
                                                <div ref={provided.innerRef} {...provided.droppableProps}>
                                                    {m.subMilestones.map((sub, subIdx) => (
                                                        <SubMilestoneItem
                                                            key={sub.id}
                                                            sub={sub}
                                                            index={subIdx}
                                                            canToggle={canToggle}
                                                            onToggle={(checked) => handleSubToggle(subIdx, checked)}
                                                            onDelete={() => handleDeleteSub(subIdx)}
                                                            teamMembers={teamMembers}
                                                            onAssign={(userId) => handleSubAssign(subIdx, userId)}
                                                            isTeamGoal={isTeamGoal}
                                                            canAssign={canAssign}
                                                        />
                                                    ))}
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </Draggable>
            <ConfirmDialog
                isOpen={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                title="Delete Milestone"
                description={`Are you sure you want to delete "${m.title}"? This will also remove any sub-milestones.`}
                onConfirm={executeDelete}
            />
        </>
    );
};

export default function GoalCard({
    goal,
    onEdit,
    onDelete,
    onUpdate,
    onCreateTaskFromMilestone,
    onMouseEnter,
    onMouseLeave,
    isFocused,
    onEditNote,
    focusedNoteId,
    onNoteEnter,
    onNoteLeave
}) {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const playSuccessSound = useSound('/sounds/complete.mp3');

    // Fetch team members if it's a team goal
    const { data: teamMembers = [] } = useQuery({
        queryKey: ['teamMembers', goal.team_id],
        queryFn: () => channelsApi.getMembers(goal.team_id),
        enabled: !!goal.team_id
    });

    const currentMembership = (teamMembers || []).find(m => m.user_id === user?.id);

    const { data: notes = [] } = useQuery({
        queryKey: ['goalNotes', goal.id],
        queryFn: () => collaborationApi.goals.getNotes(goal.id),
    });

    // Initialize with ID sanitization
    const [localMilestones, setLocalMilestones] = useState(() => ensureIds(goal.milestones || []));

    // Collapsing sections
    const [isMilestonesExpanded, setIsMilestonesExpanded] = useState(false);
    const [isNotesExpanded, setIsNotesExpanded] = useState(false);
    // Added: track dragging state
    const [isDragging, setIsDragging] = useState(false);

    // Get all unique participating members
    const participatingMembers = Array.from(new Set((localMilestones || []).map(m => m.assigned_to).filter(Boolean)))
        .map(uid => (teamMembers || []).find(tm => tm.user_id === uid))
        .filter(Boolean);

    // Sync from props if strict change
    useEffect(() => {
        const incoming = ensureIds(goal.milestones || []);
        if (JSON.stringify(incoming.map(i => i.id)) !== JSON.stringify(localMilestones.map(i => i.id))) {
            setLocalMilestones(incoming);
        }
    }, [goal.milestones]);

    const deleteNoteMutation = useMutation({
        mutationFn: (noteId) => collaborationApi.goals.deleteNote(goal.id, noteId),
        onSuccess: () => queryClient.invalidateQueries(['goalNotes', goal.id])
    });

    const calculateProgressForUpdate = (milestones) => {
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

    const handleGoalUpdate = (updatePayload) => {
        if (updatePayload.data.progress === 100) {
            updatePayload.data.status = 'DONE';
        } else if (goal.status === 'DONE' && updatePayload.data.progress < 100) {
            updatePayload.data.status = 'IN_PROGRESS';
        }
        onUpdate(updatePayload);
    };

    // Added: Set dragging true
    const onDragStart = () => {
        setIsDragging(true);
    };

    const onDragEnd = (result) => {
        // Added: Set dragging false
        setIsDragging(false);
        const { source, destination, type } = result;
        if (!destination) return;

        if (type === 'MILESTONE') {
            if (source.index === destination.index) return;
            const reordered = reorder(localMilestones || [], source.index, destination.index);
            setLocalMilestones(reordered); // Optimistic update

            const newProgress = calculateProgressForUpdate(reordered);
            handleGoalUpdate({ id: goal.id, data: { milestones: reordered, progress: newProgress } });
        } else if (type === 'SUB_MILESTONE') {
            const parentId = source.droppableId.replace('sub-', '');
            if (source.droppableId !== destination.droppableId) return;

            const parentIndex = (localMilestones || []).findIndex(m => m.id === parentId);
            if (parentIndex === -1) return;

            const parent = (localMilestones || [])[parentIndex];
            const reorderedSubs = reorder(parent.subMilestones || [], source.index, destination.index);

            const newMilestones = [...(localMilestones || [])];
            newMilestones[parentIndex] = { ...parent, subMilestones: reorderedSubs };

            setLocalMilestones(newMilestones);

            const newProgress = calculateProgressForUpdate(newMilestones);
            handleGoalUpdate({ id: goal.id, data: { milestones: newMilestones, progress: newProgress } });
        }
    };

    const calculatedProgress = calculateProgressForUpdate(localMilestones || []);
    const completedMilestones = (localMilestones || []).filter(m => m.completed).length;
    const totalMilestones = (localMilestones || []).length;

    const handleAddNoteClick = () => {
        onEditNote({
            id: 'new',
            goal_id: goal.id,
            progress_point: calculatedProgress,
            milestone: (localMilestones || []).find((m, i) => m.completed && i === (localMilestones || []).length - 1)?.title || null
        });
    };

    return (
        <Card
            className={cn(
                "bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/60 rounded-2xl group/goal relative flex flex-col h-full",
                isDragging
                    ? "z-50 ring-1 ring-slate-200 dark:ring-slate-800 transition-none duration-0"
                    : "hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 shadow-sm overflow-hidden",
                isFocused && !isDragging && "ring-1 ring-slate-300 dark:ring-slate-700 border-slate-300 dark:border-slate-700"
            )}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >

            <CardHeader className="pb-4 pt-5 space-y-4">
                <div className="flex items-start justify-between">
                    <div className="flex gap-1.5 flex-wrap">
                        <Badge variant="secondary" className={cn(
                            categoryColors[goal.category] || categoryColors.other,
                            "shadow-none font-semibold text-[10px] px-2 py-0 uppercase tracking-tight rounded-md border-none"
                        )}>
                            {goal.category}
                        </Badge>
                        <Badge variant="secondary" className={cn(
                            statusColors[goal.status],
                            "shadow-none font-semibold text-[10px] px-2 py-0 uppercase tracking-tight rounded-md border-none"
                        )}>
                            {goal.status.replace('_', ' ')}
                        </Badge>
                        {goal.priority === 'high' && (
                            <Badge className="bg-red-50/50 text-red-500 dark:bg-red-950/20 dark:text-red-400 font-semibold text-[10px] px-2 py-0 uppercase tracking-tight rounded-md border-none shadow-none">
                                Urgent
                            </Badge>
                        )}
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl border-slate-200 dark:border-slate-800">
                            {goal.team_id && (
                                <DropdownMenuItem disabled className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 py-1 border-b border-slate-50 dark:border-slate-800">
                                    <Users className="w-3 h-3 mr-2" /> Team Goal
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={() => onEdit(goal)}
                                className="cursor-pointer text-sm font-medium"
                            >
                                <Edit className="w-4 h-4 mr-2" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => onDelete(goal)}
                                className="text-red-600 cursor-pointer text-sm font-medium"
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete Object
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="space-y-2 pt-1">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                {goal.team_id && (
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                )}
                                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white leading-tight tracking-tight">
                                    {goal.title}
                                </CardTitle>
                            </div>
                            {goal.target_date && (
                                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>Due {format(new Date(goal.target_date), 'MMM d, yyyy')}</span>
                                </div>
                            )}
                        </div>

                        {/* Participating members area */}
                        {goal.team_id && (
                            <CollaboratorPreview
                                teamId={goal.team_id}
                                existingMembers={participatingMembers.length > 0 ? participatingMembers : undefined}
                                size="sm"
                            />
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {goal.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-5 line-clamp-2">
                        {goal.description}
                    </p>
                )}

                <div className="mb-8 mt-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-tight">
                        <span>Project Completion</span>
                        <span className="text-slate-600 dark:text-slate-300">{calculatedProgress}%</span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${calculatedProgress}%` }}
                            transition={{ duration: 1, ease: "circOut" }}
                            className={cn(
                                "h-full transition-all duration-500",
                                calculatedProgress === 100 ? "bg-emerald-500" : "bg-slate-700 dark:bg-slate-400"
                            )}
                        />
                    </div>
                </div>

                <div className="space-y-4 mb-4">
                    <div
                        className="flex items-center justify-between cursor-pointer group/header py-1"
                        onClick={() => setIsMilestonesExpanded(!isMilestonesExpanded)}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 group-hover/header:text-slate-600 transition-colors">
                                {isMilestonesExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </span>
                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.1em]">
                                Key Milestones ({completedMilestones}/{totalMilestones})
                            </p>
                        </div>
                    </div>

                    <AnimatePresence>
                        {isMilestonesExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="relative ml-2 pl-4 border-l border-slate-100 dark:border-slate-800 space-y-3 pb-2">
                                    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
                                        <Droppable droppableId="milestones" type="MILESTONE">
                                            {(provided) => (
                                                <div
                                                    {...provided.droppableProps}
                                                    ref={provided.innerRef}
                                                    className="space-y-1"
                                                >
                                                    {localMilestones.map((m, idx) => (
                                                        <MilestoneItem
                                                            key={m.id}
                                                            m={m}
                                                            index={idx}
                                                            goal={goal}
                                                            localList={localMilestones}
                                                            onUpdate={handleGoalUpdate}
                                                            onCreateTaskFromMilestone={onCreateTaskFromMilestone}
                                                            calculateProgressForUpdate={calculateProgressForUpdate}
                                                            updateLocalMilestones={setLocalMilestones}
                                                            teamMembers={teamMembers}
                                                            user={user}
                                                            currentMembership={currentMembership}
                                                        />
                                                    ))}
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                    </DragDropContext>

                                    {/* Add New Milestone Input */}
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            const val = e.target.elements.newMilestone.value.trim();
                                            if (!val) return;
                                            const newMilestone = {
                                                id: crypto.randomUUID(),
                                                title: val,
                                                completed: false,
                                                subMilestones: []
                                            };

                                            const updatedList = [...localMilestones, newMilestone];
                                            setLocalMilestones(updatedList);
                                            const newProgress = calculateProgressForUpdate(updatedList);
                                            handleGoalUpdate({ id: goal.id, data: { milestones: updatedList, progress: newProgress } });
                                            e.target.reset();
                                        }}
                                        className="flex items-center gap-2 mt-3 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group/add"
                                    >
                                        <div className="h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-600 border-dashed group-hover/add:border-indigo-400 transition-colors flex items-center justify-center">
                                            <Plus className="w-3 h-3 text-slate-400 group-hover/add:text-indigo-500 transition-colors" />
                                        </div>
                                        <input
                                            name="newMilestone"
                                            placeholder="Add milestone..."
                                            className="bg-transparent text-sm w-full focus:outline-none text-slate-600 dark:text-slate-400 placeholder:text-slate-400 font-medium"
                                        />
                                    </form>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Notes Section - Kept as is mostly, just cleaning up wrappers if needed */}
                {((notes || []).length > 0 || true) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-3">
                            <div
                                className="flex items-center justify-between cursor-pointer group/header"
                                onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                            >
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400 group-hover/header:text-slate-600 transition-colors">
                                        {isNotesExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    </span>
                                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">Progress Notes</p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddNoteClick();
                                    }}
                                    className="h-6 px-2 text-xs hover:bg-indigo-50 hover:text-indigo-600"
                                >
                                    <Plus className="w-3 h-3 mr-1" /> Add Note
                                </Button>
                            </div>

                            <AnimatePresence>
                                {isNotesExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar p-1"
                                    >
                                        {(notes || []).map((note) => {
                                            const colorObj = NOTE_COLORS.find(c => c.name === note.color) || NOTE_COLORS[0];
                                            return (
                                                <motion.div
                                                    layout
                                                    key={note.id}
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    onClick={() => onEditNote(note)}
                                                    onMouseEnter={(e) => {
                                                        e.stopPropagation();
                                                        onNoteEnter && onNoteEnter(note);
                                                    }}
                                                    onMouseLeave={() => {
                                                        onNoteLeave && onNoteLeave();
                                                    }}
                                                    className={cn(
                                                        "text-xs p-2.5 w-full rounded-xl border cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] group flex justify-between items-center",
                                                        colorObj.value,
                                                        focusedNoteId === note.id && "ring-1 ring-indigo-500 border-indigo-500 shadow-lg"
                                                    )}
                                                >
                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <p className="font-semibold text-slate-900 dark:text-white truncate">{note.title || "Untitled Note"}</p>
                                                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                                            {note.progress_point !== undefined && (
                                                                <span>At {note.progress_point}% progress</span>
                                                            )}
                                                            {!note.progress_point && (note.updated_at || note.created_at) && (
                                                                <span>{formatDate(note.updated_at || note.created_at)}</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {note.is_favorite && <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />}

                                                        <div className="flex items-center gap-0.5">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onEditNote(note);
                                                                }}
                                                                className="h-7 w-7 rounded-sm text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    deleteNoteMutation.mutate(note.id);
                                                                }}
                                                                className="h-7 w-7 rounded-sm text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}