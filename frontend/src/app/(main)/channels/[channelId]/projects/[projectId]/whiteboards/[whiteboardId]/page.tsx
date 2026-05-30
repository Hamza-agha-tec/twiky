'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Loader2, X, Cloud, Check, MonitorPlay, SkipBack, SkipForward, ChevronLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import ExcalidrawWrapper from '@/components/ExcalidrawWrapper';
import ThemeToggleButton from '@/components/ThemeToggleButton';
import NotificationBell from '@/components/NotificationBell';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collaborationApi, ProjectWhiteboard } from '@/lib/collaboration-api';
import { getSocket } from '@/lib/socket';
import debounce from 'lodash.debounce';
import { throttle } from 'lodash';

interface ExcalidrawWithDelayProps {
    currentWhiteboard: ProjectWhiteboard;
    handleOnChange: (elements: any, appState: any, files: any) => void;
    excalidrawRef: React.MutableRefObject<any>;
    onPointerUpdate: (payload: any) => void;
    collaborators: Map<string, any>;
    isPresenting: boolean;
}

// Helper component to delay rendering for stability
function ExcalidrawWithDelay({
    currentWhiteboard,
    handleOnChange,
    excalidrawRef,
    onPointerUpdate,
    collaborators,
    isPresenting
}: ExcalidrawWithDelayProps) {
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShouldRender(true);
        }, 300);
        return () => clearTimeout(timer);
    }, []);

    if (!shouldRender) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <ExcalidrawWrapper
            key={currentWhiteboard.id}
            initialData={currentWhiteboard.data}
            onChange={handleOnChange}
            onPointerUpdate={onPointerUpdate}
            isPresenting={isPresenting}
            excalidrawAPI={(api: any) => {
                if (excalidrawRef) {
                    excalidrawRef.current = api;
                }
            }}
        />
    );
}

export default function WhiteboardDetailPage() {
    const { channelId, projectId, whiteboardId } = useParams<{ channelId: string; projectId: string; whiteboardId: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Fetch current whiteboard
    const { data: whiteboard, isLoading, error } = useQuery({
        queryKey: ['whiteboard', whiteboardId],
        queryFn: () => collaborationApi.whiteboards.get(whiteboardId),
        enabled: !!whiteboardId
    });

    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'syncing'>('saved');
    const excalidrawRef = useRef<any>(null);
    const socketRef = useRef<any>(null);
    const [collaborators, setCollaborators] = useState(new Map());

    // Presentation Mode State
    const [isPresenting, setIsPresenting] = useState(false);
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [orderedFrames, setOrderedFrames] = useState<any[]>([]);
    const [isBrowserFullScreen, setIsBrowserFullScreen] = useState(false);

    const toggleBrowserFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((e) => {
                toast.error(`Error attempting to enable full-screen mode: ${e.message}`);
            });
            setIsBrowserFullScreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsBrowserFullScreen(false);
            }
        }
    };

    useEffect(() => {
        const handleFullScreenChange = () => {
            setIsBrowserFullScreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
    }, []);

    // Update collaborators in scene when state changes
    useEffect(() => {
        if (excalidrawRef.current && collaborators.size > 0) {
            excalidrawRef.current.updateScene({
                collaborators: Object.fromEntries(collaborators)
            });
        }
    }, [collaborators]);

    // Delta Sync Version Tracking
    const syncStateRef = useRef({
        lastVersions: new Map(),
        pendingChanges: new Map(),
        pendingFiles: new Map()
    });

    /**
     * Realtime Sync Setup (Socket.IO)
     */
    useEffect(() => {
        if (!whiteboard || !user) return;

        let activeSocket: any = null;

        const setupSocket = async () => {
            const socket = await getSocket();
            activeSocket = socket;
            socketRef.current = socket;

            // Join the whiteboard room
            socket.emit('whiteboard:join', { whiteboardId });

            // Listen for element changes
            socket.on('whiteboard:element-change', (payload: any) => {
                const { elements: incomingElements, files: incomingFiles, sender } = payload;
                if (sender === user.id) return;

                if (excalidrawRef.current) {
                    setSaveStatus('syncing');

                    if (incomingFiles && incomingFiles.length > 0) {
                        excalidrawRef.current.addFiles(incomingFiles);
                    }

                    const currentElements = excalidrawRef.current.getSceneElementsIncludingDeleted();
                    const elementMap = new Map(currentElements.map((el: any) => [el.id, el]));

                    incomingElements.forEach((el: any) => {
                        elementMap.set(el.id, el);
                    });

                    excalidrawRef.current.updateScene({
                        elements: Array.from(elementMap.values())
                    });

                    incomingElements.forEach((el: any) => {
                        syncStateRef.current.lastVersions.set(el.id, el.version);
                    });

                    setTimeout(() => setSaveStatus('saved'), 500);
                }
            });

            // Listen for cursor movements
            socket.on('whiteboard:cursor-move', (payload: any) => {
                const { x, y, username, sender } = payload;
                if (sender === user.id) return;

                setCollaborators(prev => {
                    const next = new Map(prev);
                    next.set(sender, {
                        username,
                        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${username}`,
                        x, y
                    });
                    return next;
                });
            });
        };

        setupSocket();

        return () => {
            if (activeSocket) {
                activeSocket.emit('whiteboard:leave', { whiteboardId });
                activeSocket.off('whiteboard:element-change');
                activeSocket.off('whiteboard:cursor-move');
            }
        };
    }, [whiteboardId, user, whiteboard]);

    /**
     * Throttled Broadcasts
     */
    const triggerThrottledBroadcast = useCallback(
        throttle(() => {
            if (!socketRef.current || !user) return;

            const changes = Array.from(syncStateRef.current.pendingChanges.values());
            const filesToSend = Array.from(syncStateRef.current.pendingFiles.values());

            if (changes.length === 0 && filesToSend.length === 0) return;

            socketRef.current.emit('whiteboard:element-change', {
                whiteboardId,
                elements: changes,
                files: filesToSend,
                sender: user.id
            });

            syncStateRef.current.pendingChanges.clear();
            syncStateRef.current.pendingFiles.clear();
        }, 100),
        [user, whiteboardId]
    );

    const onPointerUpdate = useCallback(
        throttle((payload: any) => {
            if (!user || !socketRef.current) return;
            socketRef.current.emit('whiteboard:cursor-move', {
                whiteboardId,
                x: payload.pointer.x,
                y: payload.pointer.y,
                username: user.username || 'User',
                sender: user.id
            });
        }, 50),
        [user, whiteboardId]
    );

    /**
     * Persistence
     */
    const debouncedSave = useCallback(
        debounce(async (id: string, title: string, data: any) => {
            setSaveStatus('saving');
            try {
                const minimalAppState = {
                    viewBackgroundColor: data.appState?.viewBackgroundColor,
                    gridSize: data.appState?.gridSize,
                    theme: data.appState?.theme,
                };

                await collaborationApi.whiteboards.update(id, {
                    title,
                    project_id: projectId, // Pass the project ID from params
                    data: {
                        elements: data.elements,
                        appState: minimalAppState,
                        files: data.files
                    }
                });
                setSaveStatus('saved');
            } catch (err) {
                console.error("Save failed", err);
                setSaveStatus('unsaved');
                toast.error("Failed to save changes");
            }
        }, 2000),
        [projectId]
    );

    const handleOnChange = (elements: any, appState: any, files: any) => {
        if (!whiteboard || !user) return;

        elements.forEach((el: any) => {
            const lastVersion = syncStateRef.current.lastVersions.get(el.id) || -1;
            if (el.version > lastVersion) {
                syncStateRef.current.pendingChanges.set(el.id, el);
                syncStateRef.current.lastVersions.set(el.id, el.version);

                if (el.type === 'image' && el.fileId && files && files[el.fileId]) {
                    syncStateRef.current.pendingFiles.set(el.fileId, files[el.fileId]);
                }
            }
        });

        triggerThrottledBroadcast();
        setSaveStatus('unsaved');
        debouncedSave(whiteboardId, whiteboard.title, { elements, appState, files });
    };

    /**
     * Presentation Mode
     */
    const startPresentation = () => {
        if (!excalidrawRef.current) return;
        const elements = excalidrawRef.current.getSceneElements();
        const frames = elements.filter((el: any) => el.type === 'frame')
            .sort((a: any, b: any) => {
                if (Math.abs(a.y - b.y) > 100) return a.y - b.y;
                return a.x - b.x;
            });

        if (frames.length === 0) {
            toast.error("No frames found to present");
            return;
        }

        setOrderedFrames(frames);
        setCurrentFrameIndex(0);
        setIsPresenting(true);
        excalidrawRef.current.scrollToContent(frames[0], { fitToContent: true });
    };

    const navigatePresentation = useCallback((direction: 'next' | 'prev') => {
        let newIndex = direction === 'next' ? currentFrameIndex + 1 : currentFrameIndex - 1;
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= orderedFrames.length) newIndex = orderedFrames.length - 1;

        if (newIndex !== currentFrameIndex) {
            setCurrentFrameIndex(newIndex);
            excalidrawRef.current.scrollToContent(orderedFrames[newIndex], { fitToContent: true });
        }
    }, [currentFrameIndex, orderedFrames]);

    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-slate-400" />
                    <p className="text-sm font-medium text-slate-500">Loading Whiteboard...</p>
                </div>
            </div>
        );
    }

    if (error || !whiteboard) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-950/20 rounded-2xl flex items-center justify-center mb-4">
                    <X className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Whiteboard Not Found</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
                    This whiteboard may have been deleted or you might not have permission to view it.
                </p>
                <Button onClick={() => router.back()} variant="outline">Go Back</Button>
            </div>
        );
    }

    return (
        <div className="h-screen w-full flex flex-col overflow-hidden bg-white dark:bg-slate-950 relative">
            {/* Toolbar Overlay */}
            <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="h-9 w-9 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 shadow-sm"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold text-slate-900 dark:text-white px-3 py-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                            {whiteboard.title}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                    {/* Status Indicator */}
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm">
                        {saveStatus === 'saving' && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                        {saveStatus === 'syncing' && <Cloud className="w-3 h-3 animate-pulse text-indigo-500" />}
                        {saveStatus === 'saved' && <Check className="w-3 h-3 text-emerald-500" />}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {saveStatus}
                        </span>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-1 flex items-center gap-1 shadow-sm">
                        <Button
                            variant={isPresenting ? "default" : "ghost"}
                            size="icon"
                            onClick={isPresenting ? () => setIsPresenting(false) : startPresentation}
                            className="h-8 w-8 rounded-lg"
                            title="Presentation Mode"
                        >
                            <MonitorPlay className="w-4 h-4" />
                        </Button>
                        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
                        <ThemeToggleButton variant="ghost" size="icon" />
                        <NotificationBell />
                    </div>
                </div>
            </div>

            {/* Presentation Controls */}
            {isPresenting && orderedFrames.length > 0 && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-full px-6 py-3 shadow-2xl">
                    <Button variant="ghost" size="icon" onClick={() => navigatePresentation('prev')} disabled={currentFrameIndex === 0}>
                        <SkipBack className="w-5 h-5" />
                    </Button>
                    <span className="text-sm font-bold tabular-nums">
                        {currentFrameIndex + 1} / {orderedFrames.length}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => navigatePresentation('next')} disabled={currentFrameIndex === orderedFrames.length - 1}>
                        <SkipForward className="w-5 h-5" />
                    </Button>
                    <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-800 mx-2" />
                    <Button variant="ghost" size="sm" onClick={() => setIsPresenting(false)} className="text-xs font-bold text-slate-500">Exit</Button>
                </div>
            )}

            {/* Canvas */}
            <div className="flex-1 w-full excalidraw-wrapper">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .excalidraw-wrapper .layer-ui__wrapper .sidebar-trigger,
                    .excalidraw-wrapper .layer-ui__wrapper .layer-ui__wrapper__top-right {
                        display: none !important;
                    }
                `}} />
                <ExcalidrawWithDelay
                    currentWhiteboard={whiteboard}
                    handleOnChange={handleOnChange}
                    excalidrawRef={excalidrawRef}
                    onPointerUpdate={onPointerUpdate}
                    collaborators={collaborators}
                    isPresenting={isPresenting}
                />
            </div>
        </div>
    );
}
