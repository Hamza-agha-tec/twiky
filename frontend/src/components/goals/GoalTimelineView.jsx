'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, differenceInDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, User, Target, ChevronDown, ChevronRight as ChevronRightIcon, Maximize2, Minimize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

const COLUMN_WIDTH = 42; // Slightly wider for better breathing room

export default function GoalTimelineView({ goals, teamMembers }) {
    const [viewDate, setViewDate] = useState(new Date());
    const [expandedGoals, setExpandedGoals] = useState({});
    const [expandedMilestones, setExpandedMilestones] = useState({});
    const [isFullScreen, setIsFullScreen] = useState(false);
    const scrollContainerRef = useRef(null);

    const teamGoals = useMemo(() => (goals || []).filter(g => !!g.team_id), [goals]);

    const days = useMemo(() => {
        const start = startOfMonth(subMonths(viewDate, 1));
        const end = endOfMonth(addMonths(viewDate, 2));
        return eachDayOfInterval({ start, end });
    }, [viewDate]);

    const totalWidth = (days || []).length * COLUMN_WIDTH;

    useEffect(() => {
        if (scrollContainerRef.current) {
            const todayIdx = (days || []).findIndex(d => isSameDay(d, new Date()));
            if (todayIdx !== -1) {
                scrollContainerRef.current.scrollLeft = (todayIdx * COLUMN_WIDTH) - (scrollContainerRef.current.offsetWidth / 2);
            }
        }
    }, [viewDate]);

    const getPosition = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const diff = differenceInDays(date, (days || [])[0]);
        if (diff < 0 || diff >= (days || []).length) return null;
        return diff * COLUMN_WIDTH;
    };

    const toggleGoal = (id) => setExpandedGoals(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleMilestone = (id) => setExpandedMilestones(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <AnimatePresence>
            {isFullScreen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[90]"
                    onClick={() => setIsFullScreen(false)}
                />
            )}

            <motion.div
                layout
                layoutId="team-roadmap-container"
                className={cn(
                    "flex flex-col bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 shadow-sm overflow-hidden font-sans transition-all duration-500",
                    isFullScreen
                        ? "fixed inset-8 z-[100] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl"
                        : "relative h-full rounded-3xl border border-slate-200 dark:border-slate-800"
                )}
            >
                {/* Control Bar */}
                <div className="px-8 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950 backdrop-blur-xl shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <CalendarIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">Team Roadmap</h2>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Strategic Alignment</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 transition-all">
                            <Button variant="ghost" size="icon" onClick={() => setViewDate(subMonths(viewDate, 1))} className="h-7 w-7 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </Button>
                            <span className="text-[12px] font-semibold text-slate-900 dark:text-white min-w-[100px] text-center uppercase tracking-tight">
                                {format(viewDate, 'MMMM yyyy')}
                            </span>
                            <Button variant="ghost" size="icon" onClick={() => setViewDate(addMonths(viewDate, 1))} className="h-7 w-7 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsFullScreen(!isFullScreen)}
                            className="h-9 w-9 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-800"
                        >
                            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>

                {/* Timeline Area */}
                <div className="flex-1 overflow-hidden flex flex-col relative">
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-x-auto overflow-y-auto scrollbar-hide relative"
                    >
                        <div style={{ width: totalWidth }} className="relative min-h-full bg-grid-slate-200/[0.05] dark:bg-grid-white/[0.02]">

                            {/* Vertical Status Lines (Today) */}
                            <div
                                style={{
                                    left: ((days || []).findIndex(d => isSameDay(d, new Date())) * COLUMN_WIDTH) + (COLUMN_WIDTH / 2),
                                    height: '100%'
                                }}
                                className="absolute top-0 w-px bg-slate-300 dark:bg-slate-700 pointer-events-none z-30"
                            >
                                <div className="absolute top-2 -translate-x-1/2 mt-[52px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm uppercase tracking-tight">
                                    Today
                                </div>
                            </div>

                            {/* Calendar Header */}
                            <div className="sticky top-0 z-40 flex bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                                {(days || []).map((day, i) => {
                                    const isFirstOfMonth = day.getDate() === 1;
                                    const isToday = isSameDay(day, new Date());
                                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                                    return (
                                        <div
                                            key={i}
                                            style={{ width: COLUMN_WIDTH }}
                                            className={cn(
                                                "h-14 flex flex-col items-center justify-center shrink-0 border-r border-slate-100 dark:border-slate-800/30 transition-colors",
                                                isToday && "bg-slate-100/50 dark:bg-slate-800/50",
                                                isWeekend && !isToday && "bg-slate-50/30 dark:bg-white/[0.01]"
                                            )}
                                        >
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-tight mb-0.5",
                                                isToday ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"
                                            )}>
                                                {format(day, 'EEE').slice(0, 1)}
                                            </span>
                                            <span className={cn(
                                                "text-[12px] font-semibold transition-all",
                                                isToday ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-400"
                                            )}>
                                                {day.getDate()}
                                            </span>
                                            {isFirstOfMonth && (
                                                <div className="absolute top-0 mt-[-24px] text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase bg-white dark:bg-slate-950 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
                                                    {format(day, 'MMM')}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Data Rows */}
                            <motion.div
                                variants={{
                                    show: { transition: { staggerChildren: 0.05 } }
                                }}
                                initial="hidden"
                                animate="show"
                                className="py-8 space-y-1"
                            >
                                {(teamGoals || []).map((goal) => {
                                    const startPos = getPosition(goal.created_at);
                                    const endPos = getPosition(goal.target_date);
                                    const gX = startPos ?? 20;
                                    const gW = endPos ? (endPos - gX + COLUMN_WIDTH) : (totalWidth - gX - 100);
                                    const isExpanded = expandedGoals[goal.id];

                                    return (
                                        <motion.div
                                            key={goal.id}
                                            layout
                                            variants={{
                                                hidden: { opacity: 0, x: -20 },
                                                show: { opacity: 1, x: 0 }
                                            }}
                                            className="relative group"
                                        >
                                            {/* Goal Row */}
                                            <div className="relative h-12 flex items-center">
                                                {/* Labels Column (Invisible spacer but handles clicks) */}
                                                <motion.div
                                                    layout
                                                    whileHover={{ scale: 1.01, x: 2 }}
                                                    whileTap={{ scale: 0.99 }}
                                                    style={{ left: gX, width: Math.max(gW, 200) }}
                                                    className="absolute h-9 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 rounded-xl flex items-center px-3 gap-3 transition-all cursor-pointer group/goal hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:shadow-lg hover:shadow-indigo-500/5"
                                                    onClick={() => toggleGoal(goal.id)}
                                                >
                                                    <div className="p-1 rounded-md bg-white dark:bg-slate-800 text-slate-400 group-hover/goal:text-slate-900 dark:group-hover/goal:text-white transition-colors border border-slate-100 dark:border-slate-700">
                                                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <Target className="w-4 h-4 text-slate-400 group-hover/goal:text-indigo-500 transition-colors shrink-0" />
                                                    <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 tracking-tight truncate">
                                                        {goal.title}
                                                    </span>
                                                    <div className="ml-auto flex items-center gap-3">
                                                        <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${goal.progress}%` }}
                                                                transition={{ duration: 1, ease: "circOut" }}
                                                                className="h-full bg-slate-400 dark:bg-slate-500"
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-semibold text-slate-500 w-8">{goal.progress}%</span>
                                                    </div>
                                                </motion.div>
                                            </div>

                                            {/* Milestones Hierarchy */}
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{
                                                            opacity: 1,
                                                            height: 'auto',
                                                            transition: { height: { type: "spring", bounce: 0, duration: 0.4 } }
                                                        }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="space-y-1 py-1">
                                                            {(goal.milestones || []).map((m) => {
                                                                const mStart = getPosition(m.start_date);
                                                                const mEnd = getPosition(m.end_date);
                                                                const mX = mStart ?? gX + 40;
                                                                const mW = mEnd ? (mEnd - mX + COLUMN_WIDTH) : 160;
                                                                const isMExpanded = expandedMilestones[m.id];
                                                                const mMember = (teamMembers || []).find(mt => mt.user_id === m.assigned_to);

                                                                return (
                                                                    <motion.div
                                                                        key={m.id}
                                                                        layout
                                                                        initial={{ opacity: 0, y: -10 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        className="relative"
                                                                    >
                                                                        {/* Connector line to parent goal */}
                                                                        <div
                                                                            style={{ left: gX + 16, top: -20, height: 44 }}
                                                                            className="absolute w-px bg-slate-100 dark:bg-slate-800"
                                                                        />
                                                                        <div
                                                                            style={{ left: gX + 16, width: mX - (gX + 16) }}
                                                                            className="absolute top-5 h-px bg-slate-100 dark:bg-slate-800"
                                                                        />

                                                                        <div className="relative h-10 flex items-center">
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <motion.div
                                                                                            layout
                                                                                            whileHover={{ scale: 1.02, x: 2 }}
                                                                                            whileTap={{ scale: 0.98 }}
                                                                                            style={{ left: mX, width: Math.max(mW, 140) }}
                                                                                            className={cn(
                                                                                                "absolute h-8 rounded-lg border flex items-center px-2.5 gap-2 transition-all cursor-pointer group/m hover:shadow-sm",
                                                                                                m.completed
                                                                                                    ? "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-900/40 text-emerald-700/80 dark:text-emerald-400/70"
                                                                                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                                                            )}
                                                                                            onClick={() => toggleMilestone(m.id)}
                                                                                        >
                                                                                            <div className="text-slate-300 dark:text-slate-500 group-hover/m:text-indigo-500 dark:group-hover/m:text-indigo-400 transition-colors">
                                                                                                {isMExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                                                                                            </div>
                                                                                            <div className={cn("w-1.5 h-1.5 rounded-full", m.completed ? "bg-emerald-500" : "bg-indigo-500")} />
                                                                                            <span className="text-[11px] font-semibold truncate tracking-tight">{m.title}</span>
                                                                                            {mMember && (
                                                                                                <div className="ml-auto w-4.5 h-4.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[8px] font-bold uppercase overflow-hidden">
                                                                                                    {mMember.avatar_url ? (
                                                                                                        <img src={mMember.avatar_url} alt="" className="w-full h-full object-cover" />
                                                                                                    ) : (
                                                                                                        (mMember.user_tag || mMember.user_settings?.[0]?.user_tag || mMember.user_settings?.user_tag || mMember.username || 'M').charAt(0).toUpperCase()
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </motion.div>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent className="bg-slate-900 border-slate-800 text-slate-300 p-3 rounded-xl shadow-2xl">
                                                                                        <div className="space-y-1.5">
                                                                                            <p className="text-[9px] font-black uppercase text-slate-500">Milestone</p>
                                                                                            <p className="text-sm font-bold text-white leading-none">{m.title}</p>
                                                                                            <div className="flex gap-2 pt-1">
                                                                                                {m.start_date && <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-md font-bold">{format(new Date(m.start_date), 'MMM d')} - {m.end_date ? format(new Date(m.end_date), 'MMM d') : '...'}</span>}
                                                                                                {mMember && <span className="text-[10px] text-slate-400 font-bold">@{mMember.user_tag || mMember.user_settings?.[0]?.user_tag || mMember.user_settings?.user_tag || mMember.username || 'member'}</span>}
                                                                                            </div>
                                                                                        </div>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        </div>

                                                                        {/* Sub-milestones hierarchy */}
                                                                        <AnimatePresence>
                                                                            {isMExpanded && (
                                                                                <motion.div
                                                                                    initial={{ opacity: 0, height: 0 }}
                                                                                    animate={{
                                                                                        opacity: 1,
                                                                                        height: 'auto',
                                                                                        transition: { height: { type: "spring", bounce: 0, duration: 0.3 } }
                                                                                    }}
                                                                                    exit={{ opacity: 0, height: 0 }}
                                                                                    className="overflow-hidden"
                                                                                >
                                                                                    <div className="space-y-1 relative pb-2">
                                                                                        {(m.subMilestones || []).map((sub) => {
                                                                                            const sStart = getPosition(sub.start_date);
                                                                                            const sEnd = getPosition(sub.end_date);
                                                                                            const sX = sStart ?? mX + 30;
                                                                                            const sW = sEnd ? (sEnd - sX + COLUMN_WIDTH) : 100;

                                                                                            return (
                                                                                                <motion.div
                                                                                                    key={sub.id}
                                                                                                    layout
                                                                                                    initial={{ opacity: 0, x: -10 }}
                                                                                                    animate={{ opacity: 1, x: 0 }}
                                                                                                    className="relative h-8 flex items-center"
                                                                                                >
                                                                                                    {/* Connector line to milestone */}
                                                                                                    <div
                                                                                                        style={{ left: mX + 11, top: -16, height: 32 }}
                                                                                                        className="absolute w-px bg-slate-100 dark:bg-slate-800"
                                                                                                    />
                                                                                                    <div
                                                                                                        style={{ left: mX + 11, width: sX - (mX + 11) }}
                                                                                                        className="absolute top-4 h-px bg-slate-100 dark:bg-slate-800"
                                                                                                    />

                                                                                                    <motion.div
                                                                                                        layout
                                                                                                        whileHover={{ scale: 1.03, x: 2 }}
                                                                                                        style={{ left: sX, width: Math.max(sW, 110) }}
                                                                                                        className={cn(
                                                                                                            "absolute h-6 rounded-md border border-slate-100 dark:border-slate-800 flex items-center px-2 gap-2 transition-all shadow-sm cursor-default",
                                                                                                            sub.completed
                                                                                                                ? "bg-emerald-50/30 dark:bg-emerald-500/5 text-emerald-600/60 dark:text-emerald-500/50"
                                                                                                                : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500"
                                                                                                        )}
                                                                                                    >
                                                                                                        <div className={cn("w-1 h-1 rounded-full", sub.completed ? "bg-emerald-500/60" : "bg-slate-200 dark:bg-slate-700")} />
                                                                                                        <span className="text-[10px] font-semibold tracking-tight truncate">{sub.title}</span>
                                                                                                    </motion.div>
                                                                                                </motion.div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </motion.div>
                                                                            )}
                                                                        </AnimatePresence>
                                                                    </motion.div>
                                                                );
                                                            })}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
