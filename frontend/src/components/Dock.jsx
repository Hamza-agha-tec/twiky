'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';
import {
    LayoutGrid,
    Settings,
    User,
    X
} from 'lucide-react';
import ThemeToggleButton from './ThemeToggleButton';

export default function Dock({ navigation }) {
    const [isOpen, setIsOpen] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const pathname = usePathname();
    const dockRef = useRef(null);

    // Close dock when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dockRef.current && !dockRef.current.contains(event.target)) {
                setIsOpen(false);
                setShowAll(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const topItems = navigation.slice(0, 6);
    const otherItems = navigation.slice(6);

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex flex-col items-center pb-6">
            {/* Gesture Area / Dock Trigger */}
            {!isOpen && (
                <motion.div
                    className="group flex flex-col items-center pointer-events-auto cursor-pointer"
                    onMouseEnter={() => setIsOpen(true)}
                    onClick={() => setIsOpen(true)}
                >
                    <div className="text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mb-1 uppercase tracking-widest">Menu</div>
                    <motion.div
                        className="w-32 h-1.5 bg-slate-400 dark:bg-slate-600 rounded-full backdrop-blur-sm shadow-sm"
                        layoutId="dock-handle"
                    />
                </motion.div>
            )}

            {/* Main Dock */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={dockRef}
                        initial={{ y: 20, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 20, opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="pointer-events-auto relative"
                    >
                        {/* All Apps Grid Overlay */}
                        <AnimatePresence>
                            {showAll && (
                                <motion.div
                                    initial={{ y: 20, opacity: 0, scale: 0.9 }}
                                    animate={{ y: -20, opacity: 1, scale: 1 }}
                                    exit={{ y: 20, opacity: 0, scale: 0.9 }}
                                    className="absolute bottom-full left-1/2 -translate-x-1/2 w-[95vw] max-w-3xl bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 mb-6 flex flex-col gap-6 z-50"
                                >
                                    <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Applications</h3>
                                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Browse all your tools and pages</p>
                                        </div>
                                        <button onClick={() => setShowAll(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 max-h-[60vh] overflow-y-auto px-1 pb-2 custom-scrollbar">
                                        {navigation.map((item) => {
                                            const Icon = item.icon;
                                            const url = createPageUrl(item.href);
                                            const isActive = pathname === url;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={url}
                                                    onClick={() => {
                                                        setShowAll(false);
                                                        setIsOpen(false);
                                                    }}
                                                    className="flex flex-col items-center gap-3 group p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                                                >
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 shadow-sm border",
                                                        isActive
                                                            ? "bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900"
                                                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 group-hover:border-slate-300 dark:group-hover:border-slate-600"
                                                    )}>
                                                        <Icon className="w-5 h-5" />
                                                    </div>
                                                    <span className="text-[11px] font-semibold text-center truncate w-full px-1 text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200">
                                                        {item.name}
                                                    </span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* The Bar */}
                        <div className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-md px-4 py-3 rounded-full shadow-lg border border-slate-200/60 dark:border-slate-800/60 flex items-center gap-4">
                            {/* Profile / System Items */}
                            <div className="flex items-center gap-3 pr-4 border-r border-slate-200 dark:border-slate-800">
                                <Link
                                    href="/profile"
                                    className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <User className="w-4 h-4" />
                                </Link>
                                <ThemeToggleButton />
                            </div>

                            {/* Main Navigation Items */}
                            <div className="flex items-center gap-3 px-1">
                                {topItems.map((item) => {
                                    const Icon = item.icon;
                                    const url = createPageUrl(item.href);
                                    const isActive = pathname === url;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={url}
                                            onClick={() => setIsOpen(false)}
                                            className="relative group block"
                                        >
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                                                isActive
                                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md"
                                                    : "bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                                            )}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            {isActive && (
                                                <motion.div
                                                    layoutId="active-indicator"
                                                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-slate-900 dark:bg-white"
                                                />
                                            )}
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-2 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold rounded shadow-sm opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
                                                {item.name}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>

                            {/* More / Grid Control */}
                            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
                                <button
                                    onClick={() => setShowAll(!showAll)}
                                    className={cn(
                                        "w-9 h-9 cursor-pointer rounded-xl flex items-center justify-center transition-all bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700",
                                        showAll ? "text-slate-900 dark:text-white ring-2 ring-slate-200 dark:ring-slate-700" : "text-slate-500 dark:text-slate-400"
                                    )}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <Link
                                    href="/settings"
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <Settings className="w-5 h-5" />
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
