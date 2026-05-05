'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Check, CheckCheck, Forward, FileText, Download, X } from 'lucide-react';
import { VoiceMessagePlayer } from './voice-message-player';
import { Message } from '@/lib/mock-data';
import { format } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageContextMenu } from './message-context-menu';
import { useChatThemeContext } from '@/context/ChatThemeContext';

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
  searchHighlight?: string;
  onReply?: (message: Message) => void;
  onPin?: () => void;
  onForward?: () => void;
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-400/50 text-inherit rounded-[2px] px-px">{part}</mark>
          : part
      )}
    </>
  );
}

// Realistic waveform bar heights

export function MessageBubble({ message, showAvatar = true, searchHighlight, onReply, onPin, onForward, onDelete, onReact }: MessageBubbleProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const { resolved: theme } = useChatThemeContext();

  const messageReactions = message.reactions ?? [];

  const initials = message.senderName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleAddReaction = (emoji: string) => {
    onReact?.(emoji);
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex gap-2 group relative ${message.isOwn ? 'justify-end' : 'justify-start'}`}
    >
      {!message.isOwn && (
        <div className="shrink-0 self-end">
          {showAvatar ? (
            <Avatar className="h-8 w-8">
              <AvatarImage src={message.avatar} alt={message.senderName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-8 w-8" />
          )}
        </div>
      )}

<div className={`flex flex-col max-w-sm ${message.isOwn ? 'items-end' : 'items-start'}`}>
        {/* Forwarded Indicator */}
        {message.isForwarded && (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1 px-1">
            <Forward className="h-3 w-3" />
            <span>Forwarded</span>
          </div>
        )}

        {/* Message Content */}
        <div
          ref={messageRef}
          className={`rounded-2xl relative cursor-context-menu ${
            message.type === 'image' || message.type === 'video' ? 'p-0 overflow-hidden' : message.type === 'file' || message.type === 'voice' ? 'p-0' : 'px-4 py-2.5'
          } ${
            message.type === 'voice' ? '' : message.isOwn
              ? `rounded-br-sm ${!theme.own ? 'bg-primary text-primary-foreground' : ''}`
              : `rounded-bl-sm ${!theme.other ? 'bg-muted text-foreground' : ''}`
          }`}
          style={
            message.type === 'voice' ? undefined :
            message.isOwn && theme.own
              ? { backgroundColor: theme.own, color: theme.ownText }
              : !message.isOwn && theme.other
              ? { backgroundColor: theme.other, color: theme.otherText }
              : undefined
          }
          onContextMenu={handleContextMenu}
        >
          {/* Reply Quote */}
          {message.reply && (
            <div
              className={`mb-2.5 rounded-lg overflow-hidden border-l-[3px] ${
                message.isOwn
                  ? !theme.own ? 'border-primary-foreground/60 bg-primary-foreground/10' : ''
                  : !theme.other ? 'border-primary bg-primary/8' : ''
              }`}
              style={
                message.isOwn && theme.own
                  ? { borderLeftColor: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(0,0,0,0.18)' }
                  : !message.isOwn && theme.other
                  ? { borderLeftColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.1)' }
                  : undefined
              }
            >
              <div className="px-3 py-2">
                <p className={`text-[11px] font-semibold mb-0.5 truncate ${
                  message.isOwn
                    ? !theme.own ? 'text-primary-foreground/80' : 'text-white/85'
                    : !theme.other ? 'text-primary' : 'text-white/85'
                }`}>
                  {message.reply.senderName}
                </p>
                <p className={`text-[12px] truncate leading-snug ${
                  message.isOwn
                    ? !theme.own ? 'text-primary-foreground/55' : 'text-white/55'
                    : 'text-foreground/60'
                }`}>
                  {message.reply.content}
                </p>
              </div>
            </div>
          )}

          {/* Text */}
          {message.type === 'text' && (
            <p className="text-sm wrap-break-word whitespace-pre-wrap leading-relaxed">
              {searchHighlight ? <HighlightedText text={message.content} query={searchHighlight} /> : message.content}
            </p>
          )}

          {/* Image / GIF */}
          {message.type === 'image' && (
            <img
              src={message.fileUrl || message.content}
              alt="Shared image"
              className="max-w-[200px] max-h-44 object-cover block cursor-zoom-in"
              onClick={() => setLightbox(true)}
            />
          )}

          {/* Voice Message */}
          {message.type === 'voice' && (
            <VoiceMessagePlayer
              src={message.fileUrl || message.content}
              durationSeconds={(() => {
                const m = message.content?.match(/^(\d+):(\d{2})$/)
                return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null
              })()}
            />
          )}

          {/* Video */}
          {message.type === 'video' && (
            <div className="max-w-xs overflow-hidden">
              <video
                src={message.fileUrl || message.content}
                controls
                className="max-h-64 w-full block"
                preload="metadata"
              />
            </div>
          )}

          {/* File attachment */}
          {message.type === 'file' && (
            <a
              href={message.fileUrl || message.content}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 min-w-[180px] transition-colors ${
                message.isOwn ? 'bg-white/10 hover:bg-white/20' : 'bg-primary/8 hover:bg-primary/15'
              }`}
            >
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                message.isOwn ? 'bg-white/15' : 'bg-primary/15'
              }`}>
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium truncate">
                  {(message.fileUrl || message.content)?.split('/').pop() ?? 'File'}
                </p>
                <p className="text-[10px] opacity-60">Tap to open</p>
              </div>
              <Download className="h-3.5 w-3.5 opacity-60 shrink-0" />
            </a>
          )}

          {/* Edited */}
          {message.isEdited && (
            <p className="text-[10px] opacity-60 mt-0.5">(edited)</p>
          )}
        </div>

        {/* Reactions */}
        {messageReactions.length > 0 && (
          <div className={`flex gap-1 mt-1 flex-wrap ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
            {messageReactions.map(({ emoji, count, reactedByMe }, idx) => (
              <motion.button
                key={`${message.id}-r-${idx}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleAddReaction(emoji)}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors ${
                  reactedByMe
                    ? 'bg-primary/15 border-primary/40 text-primary font-medium'
                    : 'bg-muted border-border text-foreground hover:bg-accent'
                }`}
              >
                <span>{emoji}</span>
                <span className={reactedByMe ? 'text-primary' : 'text-muted-foreground'}>{count}</span>
              </motion.button>
            ))}
          </div>
        )}

        {/* Timestamp + Read Status */}
        <div className="flex items-center gap-1 mt-1 px-1 text-[11px] text-muted-foreground">
          {isMounted && <span>{format(new Date(message.timestamp), 'HH:mm')}</span>}
          {message.isOwn && (
            <>
              {message.isRead ? (
                <CheckCheck aria-label="Read" className="h-3 w-3 text-blue-500" />
              ) : message.isDelivered ? (
                <CheckCheck aria-label="Received" className="h-3 w-3 text-muted-foreground/70" />
              ) : (
                <Check aria-label="Sent" className="h-3 w-3 text-muted-foreground/70" />
              )}
            </>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onReact={handleAddReaction}
          onReply={onReply ? () => { onReply(message); setContextMenu(null); } : undefined}
          isPinned={message.isPinned}
          isOwn={message.isOwn}
          onPin={onPin ? () => { onPin(); setContextMenu(null); } : undefined}
          onForward={onForward ? () => { onForward(); setContextMenu(null); } : undefined}
          onCopy={message.type === 'text' ? () => { navigator.clipboard.writeText(message.content); setContextMenu(null); } : undefined}
          onDelete={onDelete ? () => { onDelete(); setContextMenu(null); } : undefined}
        />
      )}

      {/* Image lightbox */}
      {lightbox && isMounted && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightbox(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={message.fileUrl || message.content}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>,
        document.body,
      )}
    </motion.div>
  );
}
