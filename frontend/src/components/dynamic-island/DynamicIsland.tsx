'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useDynamicIsland, type IslandNotification } from '@/context/DynamicIslandContext'
import { AppleText } from '@/components/chat/apple-text'

const TYPE_EMOJI: Record<IslandNotification['type'], string> = {
  dm:      '💬',
  general: '🔔',
  mention: '💙',
  invite:  '👥',
}

const TYPE_LABEL: Record<IslandNotification['type'], string> = {
  dm:      'Direct Message',
  general: 'Notification',
  mention: 'Mention',
  invite:  'Invitation',
}

export function DynamicIsland() {
  const { current, dismiss } = useDynamicIsland()
  const router = useRouter()

  const handleClick = () => {
    if (!current) return

    if (current.conversationId) {
      // Dispatch event so chat page reacts in real-time (already mounted)
      window.dispatchEvent(new CustomEvent('openDM', { detail: { conversationId: current.conversationId } }))
      // Also persist to localStorage for cold navigation
      try {
        const raw = localStorage.getItem('twiky-chat-view-state')
        const prev = raw ? JSON.parse(raw) : {}
        localStorage.setItem('twiky-chat-view-state', JSON.stringify({
          ...prev,
          activeDirectChat: current.conversationId,
          activeSurface: 'direct',
          workspaceMode: 'direct',
        }))
      } catch {}
      router.push('/chat')
    } else if (current.href) {
      router.push(current.href)
    }

    dismiss()
  }

  const typeEmoji = current ? TYPE_EMOJI[current.type] : null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div
            key={current.id}
            initial={{ width: 100, height: 28, opacity: 0, y: -14, scale: 0.86 }}
            animate={{ width: 360, height: 80, opacity: 1, y: 0, scale: 1 }}
            exit={{ width: 100, height: 28, opacity: 0, y: -14, scale: 0.86 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260, opacity: { duration: 0.14 } }}
            onClick={handleClick}
            className="relative overflow-hidden cursor-pointer pointer-events-auto"
            style={{
              borderRadius: 20,
              /* sidebar color: oklch(0.14 0.02 260) ≈ #1c1e2d */
              background: 'rgba(22, 24, 42, 0.82)',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ delay: 0.1, duration: 0.2 }}
              className="flex items-center gap-3 px-4 h-full"
            >
              {/* Avatar or emoji icon */}
              <div className="relative shrink-0">
                {current.avatar ? (
                  <>
                    <div
                      className="w-11 h-11 rounded-[14px] overflow-hidden"
                      style={{ boxShadow: '0 0 0 1.5px rgba(255,255,255,0.12)' }}
                    >
                      <Image
                        src={current.avatar}
                        alt={current.title}
                        width={44}
                        height={44}
                        className="object-cover w-full h-full"
                        unoptimized
                      />
                    </div>
                    {/* Apple emoji badge */}
                    <div
                      className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(22,24,42,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      {typeEmoji && <AppleText text={typeEmoji} emojiSize={12} />}
                    </div>
                  </>
                ) : (
                  <div
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {typeEmoji && <AppleText text={typeEmoji} emojiSize={26} />}
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-[3px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] leading-none text-white/40">
                    {TYPE_LABEL[current.type]}
                  </span>
                  <span className="w-[3px] h-[3px] rounded-full bg-white/20" />
                  <span className="text-[10px] text-white/25 leading-none">now</span>
                </div>
                <AppleText
                  text={current.title}
                  className="text-white text-[13.5px] font-bold leading-tight truncate block"
                  emojiSize={14}
                />
                <AppleText
                  text={current.body}
                  className="text-white/50 text-[11.5px] leading-tight truncate block"
                  emojiSize={12}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
