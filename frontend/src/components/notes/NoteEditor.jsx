"use client";

import { useState, useEffect } from "react";
import {
  X,
  Trash2,
  Palette,
  Clock,
  Pin,
  Maximize2,
  Minimize2,
  Users
} from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { channelsApi } from '@/lib/channels-api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from "./RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/use-debounce";
import ThemeToggleButton from "../ThemeToggleButton";

const NOTE_COLORS = [
  { name: 'slate', value: 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800' },
  { name: 'amber', value: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' },
  { name: 'blue', value: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' },
  { name: 'green', value: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' },
  { name: 'rose', value: 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800' },
  { name: 'indigo', value: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' },
];

export const NoteEditor = ({ open, onClose, note, onSave, onDelete, isLoading }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [color, setColor] = useState("slate");
  const [isPinned, setIsPinned] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [size, setSize] = useState("default");
  const [channelId, setChannelId] = useState("personal");

  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn: () => channelsApi.getUserChannels(),
    enabled: open,
  });

  useEffect(() => {
    if (note) {
      // Only update local state if the note has changed and we are not in the middle of a local update
      // Comparing updated_date is a good way to see if there's a newer version from the server
      const serverDate = note.updated_date ? new Date(note.updated_date).getTime() : 0;
      const localDate = lastSaved ? lastSaved.getTime() : 0;

      if (serverDate > localDate || !lastSaved) {
        setTitle(note.title || "");
        setContent(note.content || "");
        setTags(note.tags || []);
        setColor(note.color || "slate");
        setIsPinned(note.is_pinned || false);
        setLastSaved(note.updated_date ? new Date(note.updated_date) : null);
      }
    } else {
      setTitle("");
      setContent("");
      setTags([]);
      setColor("slate");
      setIsPinned(false);
      setLastSaved(null);
      setSize("default");
      setChannelId("personal");
    }
  }, [note, open]);

  useEffect(() => {
    if (note && open) {
      setChannelId(note.channel_id || "personal");
    }
  }, [note, open]);

  const toggleSize = () => {
    const sizes = ["default", "middle", "full"];
    const currentIndex = sizes.indexOf(size);
    const nextIndex = (currentIndex + 1) % sizes.length;
    setSize(sizes[nextIndex]);
  };

  const getSizeClass = () => {
    switch (size) {
      case "middle": return "sm:max-w-4xl";
      case "full": return "sm:max-w-full sm:w-full";
      default: return "sm:max-w-2xl";
    }
  };

  const debouncedContent = useDebounce(content, 1000);
  const debouncedTitle = useDebounce(title, 1000);

  useEffect(() => {
    if (open && (debouncedTitle !== (note?.title || "") || debouncedContent !== (note?.content || ""))) {
      handleAutoSave();
    }
  }, [debouncedTitle, debouncedContent]);

  const handleAutoSave = () => {
    onSave({ title, content, tags, color, is_pinned: isPinned, channel_id: channelId === 'personal' ? null : channelId }, true);
    setLastSaved(new Date());
  };

  const addTag = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      if (!tags.includes(tagInput.trim())) {
        const newTags = [...tags, tagInput.trim()];
        setTags(newTags);
        onSave({ title, content, tags: newTags, color, is_pinned: isPinned, channel_id: channelId === 'personal' ? null : channelId }, true);
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove) => {
    const newTags = tags.filter((t) => t !== tagToRemove);
    setTags(newTags);
    onSave({ title, content, tags: newTags, color, is_pinned: isPinned, channel_id: channelId === 'personal' ? null : channelId }, true);
  };

  const currentBg = NOTE_COLORS.find(c => c.name === color)?.value || NOTE_COLORS[0].value;

  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()} >
      <SheetContent className={`${getSizeClass()} w-full p-0 flex flex-col border-none ${currentBg} transition-all duration-500`}>
        <SheetTitle className="sr-only">Note Editor</SheetTitle>
        <SheetHeader className="p-6 pb-2 space-y-4 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const newPin = !isPinned;
                  setIsPinned(newPin);
                  onSave({ title, content, tags, color, is_pinned: newPin }, true);
                }}
                className={`h-8 w-8 rounded-xl transition-all ${isPinned ? 'text-slate-900 bg-white dark:text-white dark:bg-slate-800 shadow-sm' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Pin className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400">
                    <Palette className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="grid grid-cols-3 gap-1 p-2">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => {
                        setColor(c.name);
                        onSave({ title, content, tags, color: c.name, is_pinned: isPinned }, true);
                      }}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${c.value.split(' ')[0]} ${color === c.name ? 'border-indigo-500 scale-110' : 'border-transparent hover:scale-105'}`}
                    />
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Select value={channelId} onValueChange={(val) => {
                setChannelId(val);
                onSave({ title, content, tags, color, is_pinned: isPinned, channel_id: val === 'personal' ? null : val }, true);
              }}>
                <SelectTrigger className="h-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold text-[10px] w-auto min-w-[100px] uppercase tracking-wider rounded-xl px-3 outline-none focus:ring-0">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Users className="w-3 h-3 flex-shrink-0" />
                    <SelectValue placeholder="Personal" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  {(channels || []).map(channel => (
                    <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <ThemeToggleButton />

              <div className="flex items-center gap-1.5 px-1.5 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-full border border-slate-200/50 dark:border-slate-800/50">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSize("default")}
                  className={`h-6 w-6 rounded-full transition-all ${size === 'default' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Compact View"
                >
                  <Minimize2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSize("middle")}
                  className={`h-6 w-6 rounded-full transition-all ${size === 'middle' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Middle View"
                >
                  <Maximize2 className="h-3 w-3 rotate-45" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSize("full")}
                  className={`h-6 w-6 rounded-full transition-all ${size === 'full' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Full Screen"
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(note)}
                disabled={!note}
                className="h-8 w-8 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full text-slate-400"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Input
            placeholder="Fragment Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold bg-transparent border-none px-4 focus-visible:ring-0 placeholder:text-slate-200 dark:placeholder:text-slate-800 tracking-tight"
          />

          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="group px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700 rounded-lg uppercase tracking-wider transition-all hover:border-slate-300"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-1.5 opacity-40 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            <div className="relative">
              <Input
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={addTag}
                className="h-6 p-2 w-20 text-[10px] bg-transparent border-none focus-visible:ring-0 placeholder:text-slate-400"
              />
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden px-6">
          <RichTextEditor
            initialContent={content}
            onChange={setContent}
            editable={true}
            channelId={channelId}
          />
        </div>

        <div className="p-4 border-t border-slate-200/40 dark:border-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
            {lastSaved && (
              <>
                <Clock className="w-3 h-3" />
                <span>Last saved at {format(lastSaved, "HH:mm")}</span>
                {isLoading && (
                  <span className="flex items-center gap-2 text-slate-900 dark:text-white">
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
                    Syncing...
                  </span>
                )}
              </>
            )}
          </div>
          <Button
            onClick={() => onSave({ title, content, tags, color, is_pinned: isPinned, channel_id: channelId === 'personal' ? null : channelId })}
            disabled={isLoading}
            size="sm"
            className="h-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold px-4 hover:opacity-90"
          >
            {isLoading ? "Saving..." : "Save Now"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
