import React from "react";
import { MoreVertical, Pencil, Trash2, Maximize2, Layout } from 'lucide-react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export const WhiteBoardCard = ({ wb, onEdit, setDeletingId, onMouseEnter, onMouseLeave, isFocused, canDelete = true }) => {
    return (
        <Card
            tabIndex={0}
            onKeyDown={(e) => {
                if ((e.key === 'Delete' || e.key === 'Backspace') && canDelete) {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeletingId(wb.id);
                }
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEdit(wb);
                }
            }}
            className={cn(
                "bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/60 rounded-2xl group/goal relative flex flex-col h-full hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 shadow-sm overflow-hidden",
                isFocused && "ring-1 ring-slate-300 dark:ring-slate-700 border-slate-300 dark:border-slate-700"
            )}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div onClick={() => onEdit(wb)} className="cursor-pointer flex-1 flex flex-col">
                <CardHeader className="pb-4 pt-5 space-y-4">
                    <div className="flex items-start justify-between">
                        <div className="flex gap-1.5 flex-wrap">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 shadow-none font-semibold text-[10px] px-2 py-0 uppercase tracking-tight rounded-md border-none">
                                Whiteboard
                            </Badge>
                            <Badge variant="secondary" className="bg-emerald-50/50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-500 shadow-none font-semibold text-[10px] px-2 py-0 uppercase tracking-tight rounded-md border-none">
                                Active
                            </Badge>
                        </div>
                    </div>

                    <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <Layout className="w-3.5 h-3.5 text-slate-400" />
                                    <CardTitle className="text-base font-semibold text-slate-900 dark:text-white leading-tight tracking-tight truncate">
                                        {wb.title}
                                    </CardTitle>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-end pb-5">
                    <div className="space-y-4">
                        <div className="h-32 bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800">
                            <Maximize2 className="w-6 h-6 text-slate-300 dark:text-slate-700 opacity-50" />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-tight">
                            <span>Last Updated</span>
                            <span className="text-slate-600 dark:text-slate-300">{new Date(wb.updated_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </CardContent>
            </div>

            {/* Menu positioned absolutely outside clickable area */}
            <div className="absolute top-5 right-3 z-10">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-slate-200 dark:border-slate-800">
                        <DropdownMenuItem onClick={() => onEdit(wb)} className="cursor-pointer text-sm font-medium">
                            <Pencil className="w-4 h-4 mr-2" /> Edit Details
                        </DropdownMenuItem>
                        {canDelete && (
                            <DropdownMenuItem
                                className="text-red-600 cursor-pointer text-sm font-medium"
                                onClick={() => setDeletingId(wb.id)}
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete Object
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </Card>
    );
};

export default WhiteBoardCard;
