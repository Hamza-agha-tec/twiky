'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { SmilePlus, Paperclip, SendHorizontal, Mic, Square, X, Reply } from 'lucide-react';
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

export function Composer({ onTyping, onSendMessage, placeholder, replyTo, onCancelReply }: ComposerProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTypingRef = useRef(onTyping);
  useEffect(() => { onTypingRef.current = onTyping; }, [onTyping]);
  const uploadFile = useUploadFile();

  // Auto-resize textarea
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

  // Focus when reply opens
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

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
    }
  };

  return (
    <div className="border-t border-border bg-sidebar px-3 py-3">
      {/* Reply Preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pt-3 overflow-hidden"
          >
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border-l-2 border-primary">
              <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary">{replyTo.senderName}</p>
                <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
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

      {/* Recording Indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pt-3 overflow-hidden"
          >
            <div className="flex items-center gap-2 text-sm text-destructive">
              <motion.div
                className="h-2 w-2 rounded-full bg-destructive"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              Recording voice message...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {recordError ? (
        <p className="px-4 pt-2 text-[11px] text-destructive">{recordError}</p>
      ) : null}

      <div className="rounded-2xl border border-border bg-background px-2 py-2">
        <div className="flex items-end gap-2">
          {/* Left actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Upload image or file"
            >
              <Paperclip className={cn('h-4 w-4', isUploading && 'animate-pulse text-primary')} />
            </Button>

            <Button
              onClick={handleRecordClick}
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground',
                isRecording && 'bg-primary/10 text-primary',
              )}
              title={isRecording ? 'Stop recording' : 'Record voice'}
            >
              {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={handleFileChange}
        />

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder ?? 'Message'}
              rows={1}
              className="max-h-40 min-h-[36px] w-full resize-none border-0 bg-transparent px-2 py-2 text-[13px] leading-normal shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus:outline-none"
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-0.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Emoji"
                >
                  <SmilePlus className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" side="top" align="start">
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
            <Button
              type="button"
              onClick={handleSend}
              disabled={!message.trim()}
              size="icon"
              className="h-8 w-8 rounded-lg"
              title="Send"
            >
              <SendHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <p className="px-4 pb-3 text-[10px] text-muted-foreground">
        Enter to send · Shift+Enter for new line · Right-click for more
      </p>
    </div>
  );
}
