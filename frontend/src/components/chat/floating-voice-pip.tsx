import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import { AudioLines, Maximize2, X, Mic, MicOff, Popcorn } from 'lucide-react'
import { useVoice } from '@/context/VoiceContext'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

function RemoteVideo({ stream, isLocal }: { stream: MediaStream, isLocal?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    void el.play().catch(() => {})
    return () => {
      if (el.srcObject === stream) el.srcObject = null
    }
  }, [stream])

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn("absolute inset-0 h-full w-full object-cover", isLocal ? "scale-x-[-1]" : "")}
    />
  )
}

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export function FloatingVoicePiP({ groupName, channelUrl }: { groupName?: string, channelUrl?: string }) {
  const voice = useVoice()
  const router = useRouter()
  const [corner, setCorner] = useState<Corner>('bottom-right')
  
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  if (!voice.joinedGroupId) return null

  const handleReturn = () => {
    if (channelUrl) router.push(channelUrl)
  }

  const handleDragEnd = (event: any, info: any) => {
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    const dropX = info.point.x
    const dropY = info.point.y

    if (dropY < cy) {
      if (dropX < cx) setCorner('top-left')
      else setCorner('top-right')
    } else {
      if (dropX < cx) setCorner('bottom-left')
      else setCorner('bottom-right')
    }
    
    animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 })
    animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 })
  }

  const getCornerClasses = (c: Corner) => {
    switch (c) {
      case 'top-left': return 'top-6 left-6'
      case 'top-right': return 'top-6 right-6'
      case 'bottom-left': return 'bottom-6 left-6'
      case 'bottom-right': return 'bottom-6 right-6'
    }
  }

  // Find a stream to show in PiP
  const remoteScreenStreams = Array.from(voice.webrtc.remoteScreenStreams.values())
  const activeScreenStream = remoteScreenStreams.find(s => s.getVideoTracks().some(t => t.readyState === 'live' && !t.muted))
  const finalScreenStream = activeScreenStream || (voice.webrtc.localScreenStream?.getVideoTracks().some(t => t.readyState === 'live' && !t.muted) ? voice.webrtc.localScreenStream : undefined)

  let activeVideoStream: MediaStream | undefined
  if (!finalScreenStream) {
    const speakingIds = Array.from(voice.webrtc.remoteSpeakingUserIds)
    for (const id of speakingIds) {
      const s = voice.webrtc.remoteStreams.get(id)
      if (s && s.getVideoTracks().some(t => t.readyState === 'live' && !t.muted)) {
        activeVideoStream = s
        break
      }
    }
    if (!activeVideoStream) {
      const allStreams = Array.from(voice.webrtc.remoteStreams.values())
      activeVideoStream = allStreams.find(s => s.getVideoTracks().some(t => t.readyState === 'live' && !t.muted))
    }
    if (!activeVideoStream) {
      if (voice.webrtc.localCameraStream?.getVideoTracks().some(t => t.readyState === 'live' && !t.muted)) {
        activeVideoStream = voice.webrtc.localCameraStream
      }
    }
  }

  const displayStream = finalScreenStream || activeVideoStream
  const isLocal = displayStream === voice.webrtc.localScreenStream || displayStream === voice.webrtc.localStream

  if (displayStream) {
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
          "fixed z-50 w-[320px] h-[180px] bg-black rounded-2xl shadow-2xl overflow-hidden border border-white/10 group cursor-pointer",
          getCornerClasses(corner)
        )}
        onTap={handleReturn}
      >
        <RemoteVideo stream={displayStream} isLocal={isLocal && !finalScreenStream} />
        <div className="absolute top-3 left-3 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
          {finalScreenStream ? (isLocal ? 'Sharing Screen' : 'Viewing Screen') : (isLocal ? 'Your Camera' : 'Viewing Camera')}
        </div>
        <div className="absolute inset-0 z-50 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
          <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 border-0" onClick={(e) => { e.stopPropagation(); voice.toggleMute(); }} title={voice.isMuted ? 'Unmute' : 'Mute'}>
            {voice.isMuted ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4 text-white" />}
          </Button>
          <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 border-0" onClick={(e) => { e.stopPropagation(); handleReturn(); }} title="Maximize">
            <Maximize2 className="h-4 w-4 text-white" />
          </Button>
          <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full bg-red-500/20 hover:bg-red-500/40 border-0" onClick={(e) => { e.stopPropagation(); voice.leave(); }} title="Disconnect">
            <X className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </motion.div>
    )
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
        "fixed z-50 flex items-center gap-4 bg-card/65 backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-2xl min-w-[280px]",
        getCornerClasses(corner)
      )}
    >
      <div className="relative">
        <div className="h-10 w-10 rounded-xl bg-linear-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <AudioLines className="h-5 w-5 animate-pulse" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background animate-ping" />
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
      </div>

      <motion.div className="flex-1 min-w-0 cursor-pointer" onTap={handleReturn}>
        <h4 className="text-xs font-bold text-foreground truncate">{groupName || 'Voice Group'}</h4>
        <p className="text-[10px] text-emerald-400 font-semibold tracking-wide uppercase mt-0.5">
          Voice Connected
        </p>
      </motion.div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50"
          onClick={() => voice.toggleMute()}
          title={voice.isMuted ? 'Unmute' : 'Mute'}
        >
          {voice.isMuted ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50"
          onClick={handleReturn}
          title="Return to group"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={() => voice.leave()}
          title="Disconnect"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  )
}
