'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';
import {
    Search,
    User,
    LogOut,
    Menu,
    X,
    LayoutDashboard,
    ChevronDown,
    Plus,
    Folder,
    Hash,
    MoreVertical,
    Check,
    Bell,
    Settings,
    Grid
} from 'lucide-react';
import ThemeToggleButton from './ThemeToggleButton';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Sidebar({ navigation }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const pathname = usePathname();
    const { user } = useAuth();

    // Categorize dynamic navigation based on the user's app content
    const coreItems = navigation.filter(item =>
        ['Today', 'Dashboard', 'Analytics', 'Insights', 'FocusMode'].includes(item.name)
    );

    const toolItems = navigation.filter(item =>
        !['Today', 'Dashboard', 'Analytics', 'Insights', 'FocusMode', 'Archive'].includes(item.name)
    ).filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const archiveItem = navigation.find(item => item.name === 'Archive');

    const handleLogout = () => {
        fetch('/api/auth', { method: 'DELETE' }).then(() => window.location.href = '/');
    };

    const SidebarContent = () => (
        <div className="flex h-full font-sans">
            {/* 1. Sidebar Rail (Left) - Light Gray Background */}
            <div className="w-[80px] shrink-0 flex flex-col items-center py-8 border-r border-slate-200/40 bg-slate-50/50 dark:bg-slate-900/50 z-20">
                {/* Brand Logo - Top */}
                <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-slate-50 flex items-center justify-center mb-10 shadow-lg shadow-slate-200/20 dark:shadow-none transition-transform hover:scale-105 cursor-pointer">
                    <Check className="w-6 h-6 text-white dark:text-slate-900" strokeWidth={3} />
                </div>

                {/* Rail Icons - Persistent Navigation Icons */}
                <div className="flex-1 flex flex-col gap-6 w-full px-4 items-center">
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 transition-all cursor-pointer">
                        <Grid className="w-6 h-6" />
                    </div>
                    {/* Active Icon in Rail logic */}
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-800/50 cursor-pointer">
                        <LayoutDashboard className="w-6 h-6" />
                    </div>
                    {/* Extra Icons from Image style */}
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer">
                        <Bell className="w-6 h-6" />
                    </div>
                </div>

                {/* Profile Avatar - Bottom */}
                <div className="pb-6">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm cursor-pointer overflow-hidden transition-transform hover:scale-110">
                        {/* Using a profile-like background */}
                        <div className="w-full h-full bg-gradient-to-tr from-orange-500 to-rose-500 flex items-center justify-center text-white text-xs font-bold">
                            {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Detail Panel (Right) - Solid White Background */}
            <AnimatePresence initial={false}>
                {!isCollapsed && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 300, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 180 }}
                        className="bg-white dark:bg-slate-950 border-r border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden"
                    >
                        {/* Panel Header - User Context */}
                        <div className="px-7 pt-8 pb-6">
                            <div className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 p-2 -m-2 rounded-xl transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center shrink-0">
                                        <Check className="w-5 h-5 text-white dark:text-slate-900" strokeWidth={3} />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white truncate leading-tight">
                                            {user?.full_name || 'My Workspace'}
                                        </h2>
                                        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-tight">Personal Workspace</p>
                                    </div>
                                </div>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>

                            {/* Pill Search Bar - From Reference Image */}
                            <div className="mt-8 relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                                <Input
                                    placeholder="Search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-11 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100 text-[14px]"
                                />
                            </div>
                        </div>

                        {/* Navigation Items List */}
                        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-8 custom-scrollbar">
                            {/* Section 1: Core Navigation (Overview style) */}
                            <div className="space-y-1">
                                {coreItems.map((item) => {
                                    const Icon = item.icon;
                                    const url = createPageUrl(item.href);
                                    const isActive = pathname === url;
                                    return (
                                        <Link key={item.href} href={url}>
                                            <div className={cn(
                                                "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group active:scale-[0.98]",
                                                isActive
                                                    ? "bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                                                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50/50"
                                            )}>
                                                <Icon className={cn("w-5 h-5", isActive ? "scale-110" : "group-hover:translate-x-0.5 transition-transform")} />
                                                <span className="text-[14px] font-bold tracking-tight">{item.name}</span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>

                            {/* Section 2: Workspace/Tools (Detailed structure) */}
                            <div className="space-y-4">
                                <div className="px-4 flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em]">Workspace</span>
                                    <div className="w-5 h-5 rounded-md bg-green-500/10 flex items-center justify-center cursor-pointer hover:bg-green-500/20 transition-colors">
                                        <Plus className="w-3.5 h-3.5 text-green-600" />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    {/* Tools Folder Header */}
                                    <div className="flex items-center gap-4 px-4 py-2.5 text-slate-900 dark:text-white font-bold cursor-pointer hover:bg-slate-50/80 rounded-xl transition-colors">
                                        <Folder className="w-5 h-5 fill-slate-900/10" strokeWidth={2.5} />
                                        <span className="text-[14px]">Your Tools</span>
                                    </div>

                                    {/* Tools Sub-List (Nested style from image) */}
                                    <div className="pl-6 space-y-0.5 mt-1">
                                        {toolItems.map((item) => {
                                            const url = createPageUrl(item.href);
                                            const isActive = pathname === url;
                                            return (
                                                <Link key={item.href} href={url}>
                                                    <div className={cn(
                                                        "flex items-center justify-between px-4 py-2 rounded-lg transition-all group relative",
                                                        isActive ? "text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                                    )}>
                                                        {/* Line Connector logic if needed, but keeping it clean like the image */}
                                                        <div className="flex items-center gap-4">
                                                            <span className={cn(
                                                                "font-medium text-[13px] transition-colors",
                                                                isActive ? "text-slate-900" : "text-slate-300"
                                                            )}>#</span>
                                                            <span className="text-[14px] font-bold tracking-tight">{item.name}</span>
                                                        </div>
                                                        {isActive && <Check className="w-4 h-4 text-slate-900 dark:text-white" strokeWidth={3} />}
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Bottom Fixed Action (Archive) */}
                                {archiveItem && (
                                    <Link href={createPageUrl(archiveItem.href)}>
                                        <div className="flex items-center gap-4 px-4 py-4 text-slate-500 hover:text-slate-900 transition-colors mt-6 border-t border-slate-50 dark:border-slate-900 pt-8 rounded-xl">
                                            <archiveItem.icon className="w-5 h-5" />
                                            <span className="text-[14px] font-bold tracking-tight">{archiveItem.name}</span>
                                        </div>
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* Theme & Extras at Panel Bottom */}
                        <div className="p-6 border-t border-slate-50 dark:border-slate-800 bg-slate-50/20">
                            <div className="flex items-center justify-between gap-4">
                                <ThemeToggleButton />
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-slate-400 hover:text-slate-900"
                                        onClick={() => setIsCollapsed(true)}
                                    >
                                        <X className="w-4.5 h-4.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-slate-400 hover:text-red-500"
                                        onClick={handleLogout}
                                    >
                                        <LogOut className="w-4.5 h-4.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Expand Trigger when fully collapsed */}
            {isCollapsed && (
                <div className="flex-1 bg-white dark:bg-slate-950 flex flex-col items-center pt-8">
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm transition-all hover:scale-105"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar (Sticky for flex) */}
            <aside className="hidden lg:block sticky top-0 h-screen z-40 shrink-0">
                <SidebarContent />
            </aside>

            {/* Mobile View Toggle */}
            <div className="lg:hidden fixed bottom-6 right-6 z-50">
                <Button
                    variant="default"
                    size="icon"
                    className="w-14 h-14 bg-slate-900 dark:bg-slate-50 rounded-full shadow-2xl transition-transform active:scale-90"
                    onClick={() => setIsMobileOpen(true)}
                >
                    <Menu className="w-6 h-6 text-white dark:text-slate-900" />
                </Button>
            </div>

            <AnimatePresence>
                {isMobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileOpen(false)}
                            className="fixed inset-0 bg-slate-950/40 backdrop-blur-[4px] z-40 lg:hidden"
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed left-0 top-0 bottom-0 w-[85vw] max-w-[380px] z-50 lg:hidden"
                        >
                            <div className="relative h-full bg-white dark:bg-slate-950 shadow-2xl">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-6 right-6 z-[60] text-slate-400"
                                    onClick={() => setIsMobileOpen(false)}
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                                <SidebarContent />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
