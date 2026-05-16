'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Mic, MicOff, PhoneOff, Video, VideoOff, Monitor, MonitorOff, Minimize2, Maximize2, Maximize, Minimize } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useLiveKitVoice } from '@/hooks/use-livekit-voice'
import { cn } from '@/lib/utils'
import type { DmCallType } from '@/hooks/use-dm-call'

const WAVE_HEIGHTS = Array.from({ length: 26 }, (_, i) => {
  const t = i / 25
  return 0.2 + Math.abs(Math.sin(t * Math.PI * 2.5)) * 0.55 + Math.abs(Math.sin(t * Math.PI * 6.3)) * 0.25
})

function CallWaveform({ active, compact = false }: { active: boolean; compact?: boolean }) {
  return (
    <div className={cn('flex items-center justify-center gap-[2px]', compact ? 'h-5 w-28' : 'h-8 w-full')}>
      {WAVE_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className={cn('w-[2px] rounded-full transition-all duration-500', active ? 'bg-primary' : 'bg-muted-foreground/25')}
          style={{
            height: active ? `${Math.max(15, h * 100)}%` : '18%',
            transitionDelay: active ? `${i * 18}ms` : '0ms',
          }}
        />
      ))}
    </div>
  )
}

// Syncs a MediaStream to a video element's srcObject
function useSyncVideo(ref: React.RefObject<HTMLVideoElement | null>, stream: MediaStream | null | undefined) {
  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream ?? null
  }, [ref, stream])
}

interface DmCallWindowProps {
  roomId: string
  myId: string
  myName?: string
  peerId: string
  peerName: string
  peerAvatar: string | null
  type: DmCallType
  inConversation: boolean
  onHangUp: () => void
  onMinimize: () => void
  onExpand: () => void
}

export function DmCallWindow({
  roomId, myId, myName, peerId, peerName, peerAvatar, type,
  inConversation, onHangUp, onMinimize, onExpand,
}: DmCallWindowProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(type === 'video')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)

  const {
    remoteStreams, remoteScreenStreams,
    isSpeaking, isScreenSharing, localScreenStream,
    remoteSpeakingUserIds, addVideoTrack, removeVideoTrack, signalScreenShare,
  } = useLiveKitVoice(roomId, myId, isMuted)

  const containerRef = useRef<HTMLDivElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const localScreenRef = useRef<HTMLVideoElement>(null)
  const remoteCamPipRef = useRef<HTMLVideoElement>(null)
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

  const remoteStream = remoteStreams.get(peerId)
  const remoteScreenStream = remoteScreenStreams.get(peerId)

  // Determine what to show in the main area
  const remoteHasCam = Boolean(remoteStream && remoteStream.getVideoTracks().length > 0)
  const remoteIsSharing = Boolean(remoteScreenStream)

  // Main video source:
  // 1. Remote screen share
  // 2. Local screen share preview (I'm sharing)
  // 3. Remote cam
  const mainStream = remoteScreenStream ?? (isScreenSharing ? localScreenStream : null) ?? remoteStream ?? null
  const mainHasVideo = remoteIsSharing || (isScreenSharing && !!localScreenStream) || remoteHasCam

  // PiP streams: when screen sharing is active, show cams as overlays
  const showRemoteCamPip = (remoteIsSharing || isScreenSharing) && remoteHasCam
  const showLocalCamPip = isCameraOn && (remoteIsSharing || isScreenSharing || remoteHasCam)

  // Sync video elements
  useSyncVideo(remoteVideoRef, mainStream)
  useSyncVideo(localVideoRef, cameraStreamRef.current)
  useSyncVideo(localScreenRef, localScreenStream)
  useSyncVideo(remoteCamPipRef, showRemoteCamPip ? remoteStream : null)

  // Re-sync local cam after portal change
  useEffect(() => {
    if (localVideoRef.current && cameraStreamRef.current) {
      localVideoRef.current.srcObject = cameraStreamRef.current
    }
  }, [inConversation, portalTarget])

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Portal target
  useEffect(() => {
    if (!inConversation) { setPortalTarget(null); return }
    let raf: number
    const find = () => {
      const el = document.getElementById('dm-call-portal-target')
      if (el) { setPortalTarget(el); return }
      raf = requestAnimationFrame(find)
    }
    find()
    return () => cancelAnimationFrame(raf)
  }, [inConversation])

  // Fullscreen
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await containerRef.current.requestFullscreen()
    }
  }, [])

  // Camera on/off
  useEffect(() => {
    if (!isCameraOn) {
      if (cameraTrackRef.current) {
        removeVideoTrack(cameraTrackRef.current)
        cameraTrackRef.current.stop()
        cameraTrackRef.current = null
      }
      cameraStreamRef.current = null
      if (localVideoRef.current) localVideoRef.current.srcObject = null
      return
    }
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 }, facingMode: 'user' },
    }).then((stream) => {
      const track = stream.getVideoTracks()[0]
      if (!track) return
      cameraTrackRef.current = track
      cameraStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      addVideoTrack(track, stream, 'camera')
    }).catch(() => setIsCameraOn(false))
  }, [isCameraOn, addVideoTrack, removeVideoTrack])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cameraTrackRef.current) {
        removeVideoTrack(cameraTrackRef.current)
        cameraTrackRef.current.stop()
      }
    }
  }, [removeVideoTrack])

  const toggleScreenShare = async () => {
    try { await signalScreenShare(!isScreenSharing) } catch {}
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const initials = peerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const peerSpeaking = remoteSpeakingUserIds.has(peerId)

  // ── Conversation content ──────────────────────────────────────────────────
  const conversationContent = (
    <div ref={containerRef} className="flex flex-col w-full h-full bg-black">
      {/* Header */}
      <div className="h-14 border-b border-white/10 px-4 flex items-center justify-between bg-black/80 shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8">
            {peerAvatar && <AvatarImage src={peerAvatar} alt={peerName} />}
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{peerName}</p>
            <p className="text-[11px] text-white/50 font-mono">{fmt(elapsed)}</p>
          </div>
          {isSpeaking && (
            <span className="flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-primary font-medium">
              <Mic className="h-2.5 w-2.5" /> Speaking
            </span>
          )}
        </div>
        <button
          onClick={onMinimize}
          className="h-8 w-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Main video area */}
      <div className="relative flex-1 overflow-hidden bg-black flex items-center justify-center">
        {/* Main video — always mounted */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={cn(
            'w-full h-full',
            remoteIsSharing || isScreenSharing ? 'object-contain' : 'object-cover',
            !mainHasVideo && 'hidden',
          )}
        />

        {/* Avatar when no video */}
        {!mainHasVideo && (
          type === 'audio'
            ? (
              <div className="flex flex-col items-center gap-4 w-full max-w-[260px] px-4">
                <div className={cn('rounded-full transition-all duration-300', peerSpeaking ? 'ring-2 ring-primary ring-offset-4 ring-offset-black' : '')}>
                  <Avatar className="h-24 w-24">
                    {peerAvatar && <AvatarImage src={peerAvatar} alt={peerName} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-3xl">{initials}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-white">{peerName}</p>
                  <p className="text-xs text-white/50 font-mono mt-0.5">{fmt(elapsed)}</p>
                </div>
                <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <CallWaveform active={peerSpeaking} />
                </div>
              </div>
            )
            : (
              <div className="flex flex-col items-center gap-3">
                <div className={cn('rounded-full p-1.5 transition-all', peerSpeaking ? 'ring-2 ring-primary ring-offset-4 ring-offset-black' : '')}>
                  <Avatar className="h-24 w-24">
                    {peerAvatar && <AvatarImage src={peerAvatar} alt={peerName} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-3xl">{initials}</AvatarFallback>
                  </Avatar>
                </div>
                <p className="text-base font-semibold text-white">{peerName}</p>
              </div>
            )
        )}

        {/* Label on main video */}
        {mainHasVideo && (
          <span className="absolute bottom-3 left-3 z-10 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
            {remoteIsSharing ? `${peerName} is sharing` : isScreenSharing ? 'Your screen' : peerName}
          </span>
        )}

        {/* PiP overlays — bottom-right stack */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-2 z-20">
          {/* Remote cam PiP (when screen sharing active) */}
          {showRemoteCamPip && (
            <div className="relative h-28 w-[100px] rounded-xl overflow-hidden border border-white/20 shadow-xl bg-black">
              <video ref={remoteCamPipRef} autoPlay playsInline
                className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                {peerName}
              </span>
            </div>
          )}
          {/* Local cam PiP */}
          {showLocalCamPip && (
            <div className="relative h-28 w-[100px] rounded-xl overflow-hidden border border-white/20 shadow-xl bg-black">
              <video ref={localVideoRef} autoPlay playsInline muted
                className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                {myName ?? 'You'}
              </span>
            </div>
          )}
          {/* Local cam — no screen share, no remote video */}
          {isCameraOn && !showLocalCamPip && (
            <div className="relative h-28 w-[100px] rounded-xl overflow-hidden border border-white/20 shadow-xl bg-black">
              <video ref={localVideoRef} autoPlay playsInline muted
                className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                {myName ?? 'You'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 py-3 border-t border-white/10 bg-black/80 shrink-0">
        <Button size="icon" variant="ghost" onClick={() => setIsMuted(v => !v)}
          className={`h-10 w-10 rounded-full ${isMuted ? 'bg-red-500/20 text-red-400' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        {type === 'video' && (
          <Button size="icon" variant="ghost" onClick={() => setIsCameraOn(v => !v)}
            className={`h-10 w-10 rounded-full ${!isCameraOn ? 'bg-red-500/20 text-red-400' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
            {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={toggleScreenShare}
          className={`h-10 w-10 rounded-full ${isScreenSharing ? 'bg-primary/20 text-primary' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
          {isScreenSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={toggleFullscreen}
          className="h-10 w-10 rounded-full text-white/70 hover:text-white hover:bg-white/10">
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={onHangUp}
          className="h-10 w-10 rounded-full bg-red-500 hover:bg-red-600 text-white">
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  // ── PiP content ───────────────────────────────────────────────────────────
  const pipContent = (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="fixed bottom-6 right-6 z-50 w-64 rounded-xl overflow-hidden shadow-xl border border-white/10 bg-black"
    >
      <div className="relative bg-black flex items-center justify-center" style={{ aspectRatio: type === 'audio' ? 'unset' : '16/9' }}>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={cn('h-full w-full', remoteIsSharing ? 'object-contain' : 'object-cover', !mainHasVideo && 'hidden')}
        />
        {!mainHasVideo && (
          type === 'audio'
            ? (
              <div className="flex items-center gap-3 px-4 py-3 w-full">
                <Avatar className="h-9 w-9 shrink-0">
                  {peerAvatar && <AvatarImage src={peerAvatar} alt={peerName} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="text-xs font-semibold text-white truncate">{peerName}</p>
                  <CallWaveform active={peerSpeaking} compact />
                  <p className="text-[9px] font-mono text-white/40">{fmt(elapsed)}</p>
                </div>
              </div>
            )
            : (
              <div className="flex flex-col items-center gap-1.5 py-4">
                <Avatar className="h-10 w-10">
                  {peerAvatar && <AvatarImage src={peerAvatar} alt={peerName} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
                <p className="text-xs font-medium text-white">{peerName}</p>
              </div>
            )
        )}
        {isCameraOn && (
          <div className="absolute bottom-1.5 right-1.5 h-12 w-[44px] rounded-lg overflow-hidden border border-white/20">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          </div>
        )}
        {type !== 'audio' && (
          <div className="absolute top-1.5 left-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-white/60">
            {fmt(elapsed)}
          </div>
        )}
        <button onClick={onExpand}
          className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white/60 hover:text-white transition-colors">
          <Maximize2 className="h-2.5 w-2.5" />
        </button>
      </div>
      <div className="flex items-center justify-center gap-1.5 px-3 py-2 bg-black/90">
        <Button size="icon" variant="ghost" onClick={() => setIsMuted(v => !v)}
          className={`h-7 w-7 rounded-full ${isMuted ? 'bg-red-500/20 text-red-400' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
          {isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
        </Button>
        {type === 'video' && (
          <Button size="icon" variant="ghost" onClick={() => setIsCameraOn(v => !v)}
            className={`h-7 w-7 rounded-full ${!isCameraOn ? 'bg-red-500/20 text-red-400' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
            {isCameraOn ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={onHangUp}
          className="h-7 w-7 rounded-full bg-red-500 hover:bg-red-600 text-white">
          <PhoneOff className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  )

  if (inConversation && portalTarget) return createPortal(conversationContent, portalTarget)
  if (inConversation && !portalTarget) return null
  return pipContent
}

// Outgoing call / No answer
interface DmCallOutgoingProps {
  peerName: string
  peerAvatar: string | null
  type: DmCallType
  noAnswer?: boolean
  onCancel: () => void
}

export function DmCallOutgoing({ peerName, peerAvatar, type, noAnswer = false, onCancel }: DmCallOutgoingProps) {
  const initials = peerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-6 right-6 z-50 w-64 rounded-xl border border-border bg-sidebar shadow-xl overflow-hidden"
    >
      <div className="flex flex-col items-center gap-3 px-5 py-5">
        <Avatar className="h-14 w-14">
          {peerAvatar && <AvatarImage src={peerAvatar} alt={peerName} />}
          <AvatarFallback className="bg-primary text-primary-foreground text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{peerName}</p>
          <p className={`text-xs mt-0.5 ${noAnswer ? 'text-destructive' : 'text-muted-foreground animate-pulse'}`}>
            {noAnswer ? "Didn't answer" : type === 'video' ? 'Video calling…' : 'Calling…'}
          </p>
        </div>
        {!noAnswer && (
          <div className="flex flex-col items-center gap-1.5">
            <Button size="icon" variant="ghost" onClick={onCancel}
              className="h-10 w-10 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive">
              {type === 'video' ? <VideoOff className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
            </Button>
            <span className="text-[10px] text-muted-foreground">Cancel</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
