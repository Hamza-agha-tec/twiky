'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Monitor, MonitorOff } from 'lucide-react'
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
  onHangUp: () => void
}

export function DmCallWindow({ roomId, myId, peerId, peerName, peerAvatar, type, onHangUp }: DmCallWindowProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(type === 'video')
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const {
    remoteStreams,
    remoteScreenStreams,
    localStream,
    isSpeaking,
    remoteSpeakingUserIds,
    addVideoTrack,
    removeVideoTrack,
    signalScreenShare,
  } = useWebRTC(roomId, myId, isMuted)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const screenShareTrackRef = useRef<MediaStreamTrack | null>(null)
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null)

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Local video preview
  useEffect(() => {
    if (!localVideoRef.current || !localStream) return
    localVideoRef.current.srcObject = localStream
  }, [localStream])

  // Remote video
  const remoteStream = remoteStreams.get(peerId)
  const remoteScreenStream = remoteScreenStreams.get(peerId)
  useEffect(() => {
    if (!remoteVideoRef.current) return
    remoteVideoRef.current.srcObject = remoteScreenStream ?? remoteStream ?? null
  }, [remoteStream, remoteScreenStream, peerId])

  // Camera on/off
  useEffect(() => {
    if (!isCameraOn) {
      if (cameraTrackRef.current) {
        removeVideoTrack(cameraTrackRef.current)
        cameraTrackRef.current.stop()
        cameraTrackRef.current = null
      }
      return
    }

    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      const track = stream.getVideoTracks()[0]
      if (!track) return
      cameraTrackRef.current = track
      addVideoTrack(track, stream, 'camera')
    }).catch(() => setIsCameraOn(false))
  }, [isCameraOn, addVideoTrack, removeVideoTrack])

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraTrackRef.current) {
        removeVideoTrack(cameraTrackRef.current)
        cameraTrackRef.current.stop()
        cameraTrackRef.current = null
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

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const initials = peerName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  const peerSpeaking = remoteSpeakingUserIds.has(peerId)
  const hasRemoteVideo = Boolean(remoteScreenStream ?? (remoteStream && remoteStream.getVideoTracks().length > 0))

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-6 right-6 z-50 w-[320px] rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden"
    >
      {/* Video area */}
      <div className="relative bg-black aspect-video flex items-center justify-center">
        {hasRemoteVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className={`rounded-full p-1 transition-all ${peerSpeaking ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-black' : ''}`}>
              <Avatar className="h-16 w-16">
                {peerAvatar && <AvatarImage src={peerAvatar} alt={peerName} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            <p className="text-sm font-medium text-white">{peerName}</p>
          </div>
        )}

        {/* Local camera PiP */}
        {isCameraOn && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-2 right-2 h-20 w-[72px] rounded-lg object-cover border border-white/20"
          />
        )}

        {/* Timer */}
        <div className="absolute top-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-mono text-white">
          {formatElapsed(elapsed)}
        </div>

        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-green-500/80 px-2 py-0.5 text-[10px] text-white">
            <Mic className="h-2.5 w-2.5" /> You
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 bg-popover">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setIsMuted((v) => !v)}
          className={`h-10 w-10 rounded-full ${isMuted ? 'bg-red-500/10 text-red-500' : 'hover:bg-accent'}`}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>

        {type === 'video' && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsCameraOn((v) => !v)}
            className={`h-10 w-10 rounded-full ${!isCameraOn ? 'bg-red-500/10 text-red-500' : 'hover:bg-accent'}`}
          >
            {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>
        )}

        <Button
          size="icon"
          variant="ghost"
          onClick={toggleScreenShare}
          className={`h-10 w-10 rounded-full ${isScreenSharing ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}
        >
          {isScreenSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={onHangUp}
          className="h-10 w-10 rounded-full bg-red-500 hover:bg-red-600 text-white"
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  )
}

// Outgoing call (waiting for answer)
interface DmCallOutgoingProps {
  peerName: string
  peerAvatar: string | null
  type: DmCallType
  onCancel: () => void
}

export function DmCallOutgoing({ peerName, peerAvatar, type, onCancel }: DmCallOutgoingProps) {
  const initials = peerName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-6 right-6 z-50 w-[280px] rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden"
    >
      <div className="flex flex-col items-center gap-3 px-5 py-5">
        <Avatar className="h-16 w-16">
          {peerAvatar && <AvatarImage src={peerAvatar} alt={peerName} />}
          <AvatarFallback className="bg-primary text-primary-foreground text-xl">{initials}</AvatarFallback>
        </Avatar>

        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{peerName}</p>
          <p className="text-xs text-muted-foreground mt-0.5 animate-pulse">
            Calling{type === 'video' ? ' (video)' : ''}…
          </p>
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={onCancel}
          className="h-12 w-12 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </motion.div>
  )
}
