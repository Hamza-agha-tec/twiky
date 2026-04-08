'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    Search,
    X,
    LayoutDashboard,
    ListChecks,
    Target,
    CreditCard,
    StickyNote,
    User,
    Calendar,
    TrendingUp,
    FolderKanban,
    Archive as ArchiveIcon,
    Crosshair,
    GraduationCap,
    Film,
    Sparkles,
    BookMarked,
    Notebook,
    ChevronRight,
    Command,
    BookOpen,
    Users,
    Plane
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigationItems = [
    { name: 'Today', href: '/today', icon: Calendar },
    { name: 'Chat', href: '/chat', icon: LayoutDashboard },
    { name: 'Tasks', href: '/tasks', icon: ListChecks },
    { name: 'Notes', href: '/notes', icon: Notebook },
    { name: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
    { name: 'BookMarks', href: '/bookmarks', icon: BookMarked },
    { name: 'Habits', href: '/habits', icon: Target },
    { name: 'Health', href: '/health', icon: User },
    { name: 'Finance', href: '/finance', icon: CreditCard },
    { name: 'Learning', href: '/learning', icon: Target },
    { name: 'Calendar', href: '/calendar', icon: Calendar },
    { name: 'Analytics', href: '/analytics', icon: TrendingUp },
    { name: 'ThisWeek', href: '/thisweek', icon: Calendar },
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'Insights', href: '/insights', icon: TrendingUp },
    { name: 'FocusMode', href: '/focusmode', icon: Crosshair },
    { name: 'Archive', href: '/archive', icon: ArchiveIcon },
    { name: 'Goals', href: '/goals', icon: Target },
    { name: 'Journal', href: '/journal', icon: StickyNote },
    { name: 'Events', href: '/events', icon: Calendar },
    { name: 'Ideas', href: '/ideas', icon: GraduationCap },
    { name: 'Media', href: '/media', icon: Film },
    { name: 'Guide', href: '/blogs/guide', icon: BookOpen },
    { name: 'AI Recommendations', href: '/airecommendations', icon: Sparkles },
    { name: 'Team', href: '/teams', icon: Users },
    { name: 'Travel', href: '/travel', icon: Plane },
];

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const router = useRouter();
    const inputRef = useRef(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const filteredItems = search === ''
        ? navigationItems
        : navigationItems.filter(item =>
            item.name.toLowerCase().includes(search.toLowerCase())
        );

    const handleSelect = (href) => {
        router.push(href);
        setIsOpen(false);
    };

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredItems.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredItems[selectedIndex]) {
                handleSelect(filteredItems[selectedIndex].href);
            }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[9998]"
                    />
                    <div className="fixed inset-0 flex items-start justify-center pt-[15vh] pointer-events-none z-[9999]">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            className="w-full max-w-3xl bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 pointer-events-auto overflow-hidden flex flex-col max-h-[70vh]"
                        >
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                <Search className="w-5 h-5 text-slate-400" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Type a command or search..."
                                    className="flex-1 bg-transparent border-none outline-none text-base py-1 text-slate-900 dark:text-white placeholder:text-slate-400"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={onKeyDown}
                                />
                                <div className="flex items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-medium text-slate-500">ESC</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                <div className="grid grid-cols-1 gap-1">
                                    {filteredItems.map((item, index) => {
                                        const Icon = item.icon;
                                        return (
                                            <button
                                                key={item.href}
                                                onMouseEnter={() => setSelectedIndex(index)}
                                                onClick={() => handleSelect(item.href)}
                                                className={cn(
                                                    "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full text-left",
                                                    selectedIndex === index
                                                        ? "bg-slate-100 dark:bg-slate-800"
                                                        : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                                                    selectedIndex === index ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                                                )}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <span className={cn(
                                                    "text-sm font-medium",
                                                    selectedIndex === index ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"
                                                )}>
                                                    {item.name}
                                                </span>
                                                {selectedIndex === index && (
                                                    <div className="ml-auto">
                                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {filteredItems.length === 0 && (
                                    <div className="py-12 text-center">
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">No results found.</p>
                                    </div>
                                )}
                            </div>

                            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-[11px] text-slate-400">
                                <span>Navigate with arrows</span>
                                <span>Press Enter to select</span>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
