'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { SmilePlus, Paperclip, SendHorizontal, Mic, Square, X, Reply, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useUploadFile } from '@/hooks/use-messaging';
import { toast } from 'sonner';

interface ReplyTo {
  id: string;
  senderName: string;
  content: string;
}

interface ComposerProps {
  onTyping?: (isTyping: boolean) => void;
  onSendMessage?: (payload: {
    content?: string;
    type?: string;
    replyToId?: string | null;
    fileUrl?: string | null;
    mime?: string;
    duration?: number;
    size?: number;
  }) => void;
  placeholder?: string;
  replyTo?: ReplyTo | null;
  onCancelReply?: () => void;
}

const EMOJIS = [
  '😀','😂','😍','🤔','👍','🎉','🔥','😢','😡','🙏','👏','🎈',
  '❤️','😎','🥳','😅','🤣','😊','😇','🥰','😋','🤩','😴','🤯',
  '👀','💪','🌟','⚡','🎯','🚀','💡','✨',
];

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function Composer({ onTyping, onSendMessage, placeholder, replyTo, onCancelReply }: ComposerProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTypingRef = useRef(onTyping);
  useEffect(() => { onTypingRef.current = onTyping; }, [onTyping]);
  const uploadFile = useUploadFile();

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [message]);

  useEffect(() => {
    if (message) {
      onTypingRef.current?.(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => onTypingRef.current?.(false), 2000);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      onTypingRef.current?.(false);
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [message]);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  useEffect(() => {
    if (isRecording) {
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } else {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setRecordSeconds(0);
    }
    return () => { if (recordTimerRef.current) clearInterval(recordTimerRef.current); };
  }, [isRecording]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage?.({ content: message, type: 'text', replyToId: replyTo?.id ?? null });
      setMessage('');
      onCancelReply?.();
      onTyping?.(false);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleRecordClick = () => {
    if (isUploading) return;

    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }

    setRecordError(null);
    setIsRecording(true);

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        recordStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        recordChunksRef.current = [];

        recorder.ondataavailable = (evt) => {
          if (evt.data && evt.data.size > 0) recordChunksRef.current.push(evt.data);
        };

        recorder.onerror = () => {
          setRecordError('Recording failed');
          setIsRecording(false);
        };

        recorder.onstop = async () => {
          setIsRecording(false);
          try {
            const blob = new Blob(recordChunksRef.current, {
              type: recorder.mimeType || 'audio/webm',
            });
            recordChunksRef.current = [];
            recordStreamRef.current?.getTracks().forEach((t) => t.stop());
            recordStreamRef.current = null;

            const file = new File([blob], `voice-${Date.now()}.webm`, {
              type: blob.type || 'audio/webm',
            });

            setIsUploading(true);
            setUploadingLabel('Sending voice…');

            const duration = await new Promise<number | undefined>((resolve) => {
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              audio.addEventListener('loadedmetadata', () => {
                const d = Number.isFinite(audio.duration) ? audio.duration : undefined;
                URL.revokeObjectURL(url);
                resolve(d);
              });
              audio.addEventListener('error', () => {
                URL.revokeObjectURL(url);
                resolve(undefined);
              });
            });

            const { fileUrl, fileType } = await uploadFile.mutateAsync(file);
            onSendMessage?.({
              content: '',
              type: 'voice',
              replyToId: replyTo?.id ?? null,
              fileUrl,
              mime: fileType,
              duration,
              size: file.size,
            });
            onCancelReply?.();
          } catch {
            toast.error('Voice upload failed');
          } finally {
            setIsUploading(false);
            setUploadingLabel(null);
          }
        };

        recorder.start();
      })
      .catch(() => {
        setRecordError('Mic permission denied');
        setIsRecording(false);
      });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsUploading(true);
    setUploadingLabel(file.name.length > 24 ? file.name.slice(0, 22) + '…' : file.name);
    try {
      const { fileUrl, fileType } = await uploadFile.mutateAsync(file);
      const type = fileType.startsWith('image/') ? 'image' : 'file';
      onSendMessage?.({
        content: fileUrl,
        type,
        replyToId: replyTo?.id ?? null,
        fileUrl,
        mime: fileType,
        size: file.size,
      });
      onCancelReply?.();
    } catch {
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
      setUploadingLabel(null);
    }
  };

  const hasText = message.trim().length > 0;
  const busy = isUploading || isRecording;

  return (
    <div className="border-t border-border bg-sidebar px-3 pt-2 pb-3">
      {/* Reply Preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 overflow-hidden"
          >
            <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 border-l-2 border-primary">
              <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-primary">{replyTo.senderName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{replyTo.content}</p>
              </div>
              <button
                onClick={onCancelReply}
                className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-accent transition-colors shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          'rounded-2xl border bg-background transition-colors duration-150',
          isRecording
            ? 'border-destructive/60 ring-1 ring-destructive/20'
            : 'border-border focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/10',
        )}
      >
        {/* Recording bar */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1">
                <motion.div
                  className="h-2 w-2 rounded-full bg-destructive shrink-0"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-[12px] font-medium text-destructive tabular-nums">
                  {formatDuration(recordSeconds)}
                </span>
                <span className="text-[11px] text-muted-foreground">Recording…</span>
                <span className="ml-auto text-[10px] text-muted-foreground">Tap stop to send</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload bar */}
        <AnimatePresence>
          {isUploading && uploadingLabel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{uploadingLabel}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main input row */}
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          {/* File upload */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            title="Attach file"
          >
            <Paperclip className="h-[15px] w-[15px]" />
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.csv"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Textarea */}
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder ?? 'Message'}
              rows={1}
              disabled={isRecording}
              className="max-h-[120px] min-h-[34px] w-full resize-none border-0 bg-transparent px-1 py-1.5 text-[13px] leading-[1.4] shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 focus:outline-none disabled:opacity-0"
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Emoji */}
            {!isRecording && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Emoji"
                    disabled={busy}
                  >
                    <SmilePlus className="h-[15px] w-[15px]" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" side="top" align="end">
                  <div className="grid grid-cols-8 gap-1">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiSelect(emoji)}
                        className="h-8 flex items-center justify-center text-lg hover:bg-accent rounded-md transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Mic / Stop / Send */}
            <AnimatePresence mode="wait" initial={false}>
              {hasText ? (
                <motion.div
                  key="send"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  <Button
                    type="button"
                    onClick={handleSend}
                    size="icon"
                    className="h-8 w-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                    title="Send"
                  >
                    <SendHorizontal className="h-[15px] w-[15px]" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="mic"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  <Button
                    type="button"
                    onClick={handleRecordClick}
                    size="icon"
                    disabled={isUploading}
                    className={cn(
                      'h-8 w-8 rounded-xl transition-colors',
                      isRecording
                        ? 'bg-destructive text-white hover:bg-destructive/90 shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                    title={isRecording ? 'Stop recording' : 'Record voice'}
                  >
                    {isRecording
                      ? <Square className="h-[13px] w-[13px] fill-current" />
                      : <Mic className="h-[15px] w-[15px]" />
                    }
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {recordError ? (
        <p className="mt-1 px-1 text-[11px] text-destructive">{recordError}</p>
      ) : null}
    </div>
  );
}
