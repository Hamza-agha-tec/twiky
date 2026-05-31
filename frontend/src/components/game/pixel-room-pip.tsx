'use client'

import { useState } from 'react'
import { motion, animate, useMotionValue } from 'framer-motion'
import { Gamepad2, Maximize2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { usePixelPresence } from '@/context/PixelPresenceContext'
import { cn } from '@/lib/utils'

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export function PixelRoomPiP() {
  const { activeRoom, leaveRoom } = usePixelPresence()
  const router = useRouter()
  const [corner, setCorner] = useState<Corner>('bottom-right')
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  if (!activeRoom) return null

  const handleReturn = () => {
    router.push(`/channels/${activeRoom.channelId}/group/${activeRoom.groupId}`)
  }

  const handleDragEnd = (_e: any, info: any) => {
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    if (info.point.y < cy) {
      setCorner(info.point.x < cx ? 'top-left' : 'top-right')
    } else {
      setCorner(info.point.x < cx ? 'bottom-left' : 'bottom-right')
    }
    animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 })
    animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 })
  }

  const cornerClass = (c: Corner) => {
    switch (c) {
      case 'top-left': return 'top-6 left-6'
      case 'top-right': return 'top-6 right-6'
      case 'bottom-left': return 'bottom-6 left-6'
      case 'bottom-right': return 'bottom-6 right-6'
    }
  }

  return (
    <motion.div
      layout
      drag
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      style={{ x, y }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'fixed z-50 flex items-center gap-4 bg-card/65 backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-2xl min-w-[280px]',
        cornerClass(corner)
      )}
    >
      <div className="relative">
        <div className="h-10 w-10 rounded-xl bg-linear-to-br from-fuchsia-500/10 to-indigo-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400">
          <Gamepad2 className="h-5 w-5" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-fuchsia-500 border-2 border-background animate-ping" />
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-fuchsia-500 border-2 border-background" />
      </div>

      <motion.div className="flex-1 min-w-0 cursor-pointer" onTap={handleReturn}>
        <h4 className="text-xs font-bold text-foreground truncate">{activeRoom.groupName}</h4>
        <p className="text-[10px] text-fuchsia-400 font-semibold tracking-wide uppercase mt-0.5">
          Pixel Room
        </p>
      </motion.div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50"
          onClick={handleReturn}
          title="Return to room"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={() => leaveRoom()}
          title="Leave room"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  )
}
