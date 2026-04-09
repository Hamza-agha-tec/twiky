'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Smile, Paperclip, Send, Mic, X, Reply } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ReplyTo {
  senderName: string;
  content: string;
}

interface ComposerProps {
  onTyping?: (isTyping: boolean) => void;
  onSendMessage?: (content: string, type?: 'text' | 'video') => void;
  replyTo?: ReplyTo | null;
  onCancelReply?: () => void;
}

const EMOJIS = [
  '😀','😂','😍','🤔','👍','🎉','🔥','😢','😡','🙏','👏','🎈',
  '❤️','😎','🥳','😅','🤣','😊','😇','🥰','😋','🤩','😴','🤯',
  '👀','💪','🌟','⚡','🎯','🚀','💡','✨',
];

export function Composer({ onTyping, onSendMessage, replyTo, onCancelReply }: ComposerProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      onTyping?.(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => onTyping?.(false), 1000);
    } else {
      onTyping?.(false);
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [message, onTyping]);

  // Focus when reply opens
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage?.(message);
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
    setIsRecording(!isRecording);
    if (!isRecording) setTimeout(() => setIsRecording(false), 2000);
  };

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
              <Reply className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary">{replyTo.senderName}</p>
                <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
              </div>
              <button
                onClick={onCancelReply}
                className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-accent transition-colors flex-shrink-0"
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

      <div className="flex items-end gap-2 p-3">
        {/* Emoji Button */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 rounded-full">
              <Smile className="h-5 w-5 text-muted-foreground" />
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

        {/* Attachment Button */}
        <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 rounded-full">
          <Paperclip className="h-5 w-5 text-muted-foreground" />
        </Button>

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="w-full resize-none rounded-2xl bg-muted border-0 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all min-h-[40px] max-h-[120px] leading-relaxed"
          />
        </div>

        {/* Send or Voice */}
        <AnimatePresence mode="wait">
          {message.trim() ? (
            <motion.div
              key="send"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                onClick={handleSend}
                size="icon"
                className="h-9 w-9 rounded-full flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="mic"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                onClick={handleRecordClick}
                variant={isRecording ? 'destructive' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-full flex-shrink-0"
              >
                <Mic className="h-5 w-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
