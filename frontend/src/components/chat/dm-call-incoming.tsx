'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Phone, PhoneOff, Video, VideoOff } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { DmCallType } from '@/hooks/use-dm-call'

interface DmCallIncomingProps {
  callerName: string
  callerAvatar: string | null
  type: DmCallType
  onAccept: () => void
  onReject: () => void
}

export function DmCallIncoming({ callerName, callerAvatar, type, onAccept, onReject }: DmCallIncomingProps) {
  const initials = callerName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  const isVideo = type === 'video'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -24, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="fixed top-5 left-1/2 z-50 -translate-x-1/2 w-72 rounded-xl border border-border bg-sidebar shadow-xl overflow-hidden"
      >
        <div className="flex flex-col items-center gap-3 px-5 py-5">
          <div className="relative">
            <Avatar className="h-14 w-14">
              {callerAvatar && <AvatarImage src={callerAvatar} alt={callerName} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
              {isVideo ? <Video className="h-2.5 w-2.5 text-white" /> : <Phone className="h-2.5 w-2.5 text-white" />}
            </span>
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">{callerName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Incoming {isVideo ? 'video' : 'voice'} call…
            </p>
          </div>

          <div className="flex items-center gap-6 mt-1">
            {/* Decline */}
            <div className="flex flex-col items-center gap-1.5">
              <Button size="icon" variant="ghost" onClick={onReject}
                className="h-12 w-12 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive">
                {isVideo ? <VideoOff className="h-5 w-5" /> : <PhoneOff className="h-5 w-5" />}
              </Button>
              <span className="text-[10px] text-muted-foreground">Decline</span>
            </div>

            {/* Accept */}
            <div className="flex flex-col items-center gap-1.5">
              <Button size="icon" variant="ghost" onClick={onAccept}
                className="h-12 w-12 rounded-full bg-green-500/10 hover:bg-green-500/20 text-green-500">
                {isVideo ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
              </Button>
              <span className="text-[10px] text-muted-foreground">Accept</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
