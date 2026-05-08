'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useDynamicIsland } from '@/context/DynamicIslandContext'
import type { IslandNotification } from '@/context/DynamicIslandContext'

const DARK_BLUE = '#4da6e8'
const DARK_BLUE_BG = 'rgba(0,89,168,0.20)'
const DARK_BLUE_BORDER = 'rgba(0,89,168,0.50)'

const TYPE_EMOJI: Record<string, string> = {
  dm: '💬',
  general: '🔔',
  mention: '💙',
  invite: '👥',
}

const TYPE_LABEL: Record<IslandNotification['type'], string> = {
  dm: 'Direct Message',
  general: 'Notification',
  mention: 'Mention',
  invite: 'Invitation',
}

export function DynamicIsland() {
  const { current, dismiss } = useDynamicIsland()
  const router = useRouter()

  const handleClick = () => {
    if (!current) return
    if (current.conversationId) {
      try {
        const raw = localStorage.getItem('twiky-chat-view-state')
        const prev = raw ? JSON.parse(raw) : {}
        localStorage.setItem(
          'twiky-chat-view-state',
          JSON.stringify({
            ...prev,
            activeDirectChat: current.conversationId,
            activeSurface: 'direct',
            workspaceMode: 'direct',
          }),
        )
      } catch {}
      router.push('/chat')
    } else if (current.href) {
      router.push(current.href)
    }
    dismiss()
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div
            key={current.id}
            initial={{ width: 100, height: 28, opacity: 0, y: -14, scale: 0.86 }}
            animate={{ width: 360, height: 80, opacity: 1, y: 0, scale: 1 }}
            exit={{ width: 100, height: 28, opacity: 0, y: -14, scale: 0.86 }}
            transition={{
              type: 'spring',
              damping: 24,
              stiffness: 260,
              opacity: { duration: 0.14 },
            }}
            onClick={handleClick}
            className="relative overflow-hidden cursor-pointer pointer-events-auto"
            style={{
              borderRadius: 20,
              background: `linear-gradient(135deg, rgba(0,89,168,0.28) 0%, rgba(0,70,140,0.18) 100%)`,
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              border: `1px solid ${DARK_BLUE_BORDER}`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08)',
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
                      style={{ boxShadow: `0 0 0 2px ${DARK_BLUE_BORDER}` }}
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
                    {/* Type badge */}
                    <div
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px]"
                      style={{
                        background: DARK_BLUE_BG,
                        border: `1px solid ${DARK_BLUE_BORDER}`,
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      {TYPE_EMOJI[current.type]}
                    </div>
                  </>
                ) : (
                  <div
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center text-2xl"
                    style={{
                      background: DARK_BLUE_BG,
                      border: `1px solid ${DARK_BLUE_BORDER}`,
                    }}
                  >
                    {TYPE_EMOJI[current.type]}
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-[3px]">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.12em] leading-none"
                    style={{ color: DARK_BLUE }}
                  >
                    {TYPE_LABEL[current.type]}
                  </span>
                  <span className="w-[3px] h-[3px] rounded-full" style={{ background: DARK_BLUE, opacity: 0.5 }} />
                  <span className="text-[10px] text-white/35 leading-none">now</span>
                </div>
                <p className="text-white text-[13.5px] font-bold leading-tight truncate">
                  {current.title}
                </p>
                <p className="text-white/50 text-[11.5px] leading-tight truncate">
                  {current.body}
                </p>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
