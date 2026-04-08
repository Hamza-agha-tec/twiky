'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import NotificationBell from './NotificationBell';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

export default function Header() {
    const pathname = usePathname();

    // Map path to a pretty Title
    const getPageTitle = () => {
        const path = pathname.split('/').pop() || 'Dashboard';
        return path === 'udld' ? 'Dashboard' : path.charAt(0).toUpperCase() + path.slice(1);
    };

    return (
        <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-white/50 dark:bg-slate-950/50 backdrop-blur-xl transition-all duration-300">
            <div className="max-w-[1920px] mx-auto h-16 flex items-center justify-between px-8">
                <div className="flex items-center gap-3 group">
                    <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform cursor-pointer">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-widest uppercase">
                            {getPageTitle()}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Notification Bell */}
                    <NotificationBell />

                    {/* User Profile / Status could go here too if needed, but Dock has it */}
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2" />

                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Status</span>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Live</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
