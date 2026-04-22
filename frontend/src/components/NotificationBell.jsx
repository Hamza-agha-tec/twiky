'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, ExternalLink, Ghost, Inbox, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuHeader,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function NotificationBell() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const { data: notificationsData = [] } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => api.entities.Notification.list(),
        refetchInterval: 10000, // Refresh every 10 seconds
    });

    const notifications = Array.isArray(notificationsData) ? notificationsData.filter(n => n.type !== 'MENTION') : [];
    const unreadCount = notifications.filter(n => !n.is_read).length;

    const readMutation = useMutation({
        mutationFn: (id) => api.entities.Notification.update(id, { is_read: true }),
        onSuccess: () => {
            queryClient.invalidateQueries(['notifications']);
        }
    });

    const markAllReadMutation = useMutation({
        mutationFn: () => fetch('/api/notifications', {
            method: 'PATCH',
            body: JSON.stringify({ mark_all: true })
        }),
        onSuccess: () => {
            queryClient.invalidateQueries(['notifications']);
        }
    });

    const handleNotificationClick = (notification) => {
        if (!notification.is_read) {
            readMutation.mutate(notification.id);
        }
        if (notification.link) {
            router.push(notification.link);
            setOpen(false);
        }
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] font-bold text-white items-center justify-center">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px] p-0 rounded-2xl border-none shadow-2xl bg-white dark:bg-slate-950">
                <div className="p-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 rounded-t-2xl border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <Inbox className="w-4 h-4 text-primary" />
                        <h3 className="font-black text-sm tracking-tight">Notifications</h3>
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                markAllReadMutation.mutate();
                            }}
                            className="h-8 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-primary transition-colors"
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>

                <div className="h-[400px] overflow-y-auto custom-scrollbar">
                    <div className="py-2">
                        {notifications.length > 0 ? (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => handleNotificationClick(n)}
                                    className={cn(
                                        "px-4 py-4 flex gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors relative group",
                                        !n.is_read && "bg-indigo-50/30 dark:bg-indigo-900/10"
                                    )}
                                >
                                    {!n.is_read && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <p className={cn(
                                                "text-sm font-bold truncate",
                                                !n.is_read ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
                                            )}>
                                                {n.title}
                                            </p>
                                            <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium mt-0.5">
                                                {formatDistanceToNow(new Date(n.created_at))} ago
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                            {n.content}
                                        </p>
                                        {n.link && (
                                            <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                                View details <ExternalLink className="w-2.5 h-2.5" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-[300px] flex flex-col items-center justify-center text-center p-8 opacity-40">
                                <Ghost className="w-12 h-12 mb-4 text-slate-300" />
                                <p className="text-sm font-bold text-slate-500 tracking-tight">All clear!</p>
                                <p className="text-xs text-slate-400">You don't have any notifications right now.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-2 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-2xl border-t border-slate-100 dark:border-slate-800">
                    <Button variant="ghost" className="w-full h-10 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl">
                        View all activity
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
