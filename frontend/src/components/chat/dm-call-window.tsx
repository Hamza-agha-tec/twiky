'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Mic, MicOff, PhoneOff, Video, VideoOff, Monitor, MonitorOff, Minimize2, Maximize2 } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useWebRTC } from '@/hooks/use-webrtc'
import type { DmCallType } from '@/hooks/use-dm-call'

interface DmCallWindowProps {
  roomId: string
  myId: string
  peerId: string
  peerName: string
  peerAvatar: string | null
  type: DmCallType
  /** true = render inside the conversation portal slot; false = render as fixed PiP */
  inConversation: boolean
  onHangUp: () => void
  onMinimize: () => void
  onExpand: () => void
}

export function DmCallWindow({
  roomId, myId, peerId, peerName, peerAvatar, type,
  inConversation, onHangUp, onMinimize, onExpand,
}: DmCallWindowProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(type === 'video')
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)

  const { remoteStreams, remoteScreenStreams, isSpeaking, remoteSpeakingUserIds, addVideoTrack, removeVideoTrack, signalScreenShare } =
    useWebRTC(roomId, myId, isMuted)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const screenShareTrackRef = useRef<MediaStreamTrack | null>(null)
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Track portal target element (updates when inConversation changes)
  useEffect(() => {
    if (!inConversation) { setPortalTarget(null); return }
    // Poll until the portal target div is rendered
    let raf: number
    const find = () => {
      const el = document.getElementById('dm-call-portal-target')
      if (el) { setPortalTarget(el); return }
      raf = requestAnimationFrame(find)
    }
    find()
    return () => cancelAnimationFrame(raf)
  }, [inConversation])

  const remoteStream = remoteStreams.get(peerId)
  const remoteScreenStream = remoteScreenStreams.get(peerId)

  // Sync remote video element
  useEffect(() => {
    if (!remoteVideoRef.current) return
    remoteVideoRef.current.srcObject = remoteScreenStream ?? remoteStream ?? null
  }, [remoteStream, remoteScreenStream, peerId, inConversation, portalTarget])

  // Sync local camera stream after portal re-render
  useEffect(() => {
    if (!isCameraOn || !cameraStreamRef.current) return
    if (localVideoRef.current) localVideoRef.current.srcObject = cameraStreamRef.current
  }, [inConversation, portalTarget, isCameraOn])

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
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      const track = stream.getVideoTracks()[0]
      if (!track) return
      cameraTrackRef.current = track
      cameraStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      addVideoTrack(track, stream, 'camera')
    }).catch(() => setIsCameraOn(false))
  }, [isCameraOn, addVideoTrack, removeVideoTrack])

  // Cleanup camera on unmount (call ended)
  useEffect(() => {
    return () => {
      if (cameraTrackRef.current) {
        removeVideoTrack(cameraTrackRef.current)
        cameraTrackRef.current.stop()
      }
    }
  }, [removeVideoTrack])

  const toggleScreenShare = async () => {
    if (isScreenSharing && screenShareTrackRef.current) {
      removeVideoTrack(screenShareTrackRef.current)
      screenShareTrackRef.current.stop()
      screenShareTrackRef.current = null
      signalScreenShare(false)
      setIsScreenSharing(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const track = stream.getVideoTracks()[0]
      if (!track) return
      screenShareTrackRef.current = track
      track.onended = () => {
        removeVideoTrack(track)
        screenShareTrackRef.current = null
        signalScreenShare(false)
        setIsScreenSharing(false)
      }
      addVideoTrack(track, stream, 'screen')
      signalScreenShare(true)
      setIsScreenSharing(true)
    } catch {}
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const initials = peerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const peerSpeaking = remoteSpeakingUserIds.has(peerId)
  const hasRemoteVideo = Boolean(remoteScreenStream ?? (remoteStream && remoteStream.getVideoTracks().length > 0))

  // ── Conversation content (portaled into #dm-call-portal-target) ──────────
  const conversationContent = (
    <div className="flex flex-col w-full h-full bg-sidebar">
      {/* Header — same height/style as ChatWindow */}
      <div className="h-14 border-b border-border px-4 flex items-center justify-between bg-sidebar shrink-0">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-9 w-9">
            {peerAvatar && <AvatarImage src={peerAvatar} alt={peerName} />}
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{peerName}</p>
            <p className="text-[11px] text-muted-foreground font-mono">{fmt(elapsed)}</p>
          </div>
          {isSpeaking && (
            <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] text-green-500 font-medium">
              <Mic className="h-2.5 w-2.5" /> Speaking
            </span>
          )}
        </div>
        <button
          onClick={onMinimize}
          className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Video / avatar */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-background">
        {hasRemoteVideo
          ? <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-contain" />
          : (
            <div className="flex flex-col items-center gap-3">
              <div className={`rounded-full p-1.5 transition-all ${peerSpeaking ? 'ring-2 ring-green-500 ring-offset-4 ring-offset-background' : ''}`}>
                <Avatar className="h-20 w-20">
                  {peerAvatar && <AvatarImage src={peerAvatar} alt={peerName} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{initials}</AvatarFallback>
                </Avatar>
              </div>
              <p className="text-base font-semibold text-foreground">{peerName}</p>
            </div>
          )
        }
        {isCameraOn && (
          <video ref={localVideoRef} autoPlay playsInline muted
            className="absolute bottom-3 right-3 h-28 w-[100px] rounded-lg object-cover border border-border shadow-lg" />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 py-4 border-t border-border bg-sidebar shrink-0">
        <Button size="icon" variant="ghost" onClick={() => setIsMuted(v => !v)}
          className={`h-9 w-9 rounded-full ${isMuted ? 'bg-destructive/15 text-destructive' : 'hover:bg-accent'}`}>
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        {type === 'video' && (
          <Button size="icon" variant="ghost" onClick={() => setIsCameraOn(v => !v)}
            className={`h-9 w-9 rounded-full ${!isCameraOn ? 'bg-destructive/15 text-destructive' : 'hover:bg-accent'}`}>
            {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={toggleScreenShare}
          className={`h-9 w-9 rounded-full ${isScreenSharing ? 'bg-primary/15 text-primary' : 'hover:bg-accent'}`}>
          {isScreenSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={onHangUp}
          className="h-9 w-9 rounded-full bg-red-500 hover:bg-red-600 text-white">
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  // ── PiP content (fixed card, bottom-right) ───────────────────────────────
  const pipContent = (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="fixed bottom-6 right-6 z-50 w-64 rounded-xl overflow-hidden shadow-xl border border-border bg-sidebar"
    >
      <div className="relative aspect-video bg-background flex items-center justify-center">
        {hasRemoteVideo
          ? <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          : (
            <div className="flex flex-col items-center gap-1.5">
              <div className={`rounded-full ${peerSpeaking ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-background' : ''}`}>
                <Avatar className="h-10 w-10">
                  {peerAvatar && <AvatarImage src={peerAvatar} alt={peerName} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
              </div>
              <p className="text-xs font-medium text-foreground">{peerName}</p>
            </div>
          )
        }
        {isCameraOn && (
          <video ref={localVideoRef} autoPlay playsInline muted
            className="absolute bottom-1.5 right-1.5 h-12 w-[44px] rounded object-cover border border-border" />
        )}
        <div className="absolute top-1.5 left-1.5 rounded-full bg-sidebar/90 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
          {fmt(elapsed)}
        </div>
        <button onClick={onExpand}
          className="absolute top-1.5 right-1.5 rounded-full bg-sidebar/90 p-1 text-muted-foreground hover:text-foreground hover:bg-sidebar transition-colors">
          <Maximize2 className="h-2.5 w-2.5" />
        </button>
      </div>
      <div className="flex items-center justify-center gap-1.5 px-3 py-2 bg-sidebar">
        <Button size="icon" variant="ghost" onClick={() => setIsMuted(v => !v)}
          className={`h-7 w-7 rounded-full ${isMuted ? 'bg-destructive/15 text-destructive' : 'hover:bg-accent'}`}>
          {isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
        </Button>
        {type === 'video' && (
          <Button size="icon" variant="ghost" onClick={() => setIsCameraOn(v => !v)}
            className={`h-7 w-7 rounded-full ${!isCameraOn ? 'bg-destructive/15 text-destructive' : 'hover:bg-accent'}`}>
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
  if (inConversation && !portalTarget) return null // waiting for portal target to mount
  return pipContent
}

// Outgoing call
interface DmCallOutgoingProps {
  peerName: string
  peerAvatar: string | null
  type: DmCallType
  onCancel: () => void
}

export function DmCallOutgoing({ peerName, peerAvatar, type, onCancel }: DmCallOutgoingProps) {
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
          <p className="text-xs text-muted-foreground mt-0.5 animate-pulse">
            Calling{type === 'video' ? ' (video)' : ''}…
          </p>
        </div>
        <Button size="icon" variant="ghost" onClick={onCancel}
          className="h-10 w-10 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive">
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  )
}
