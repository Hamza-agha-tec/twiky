'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { WebRTCManager } from './webrtc-manager';
import { useVoicePresence } from '../../hooks/use-voice-presence';
import { useValidateRoomAccess } from '../../hooks/use-voice-rooms';
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';

interface EnhancedVoiceGroupViewProps {
  groupId: string;
  groupName: string;
  channelId?: string;
  onLeave?: () => void;
}

export function EnhancedVoiceGroupView({
  groupId,
  groupName,
  channelId,
  onLeave,
}: EnhancedVoiceGroupViewProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const { mutate: validateAccess } = useValidateRoomAccess();
  const supabase = createClient();

  // Get current user info
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Initialize WebRTC Manager
  useEffect(() => {
    if (!currentUser) return;

    const initWebRTC = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const manager = new WebRTCManager();
        webrtcManagerRef.current = manager;

        // Set up event listeners
        manager.on('user-joined', (userId: string) => {
          console.log('User joined:', userId);
        });

        manager.on('user-left', (userId: string) => {
          console.log('User left:', userId);
          setRemoteStreams(prev => {
            const newStreams = new Map(prev);
            newStreams.delete(userId);
            return newStreams;
          });
        });

        manager.on('user-audio-toggled', (userId: string, muted: boolean) => {
          console.log(`User ${userId} audio toggled:`, muted);
        });

        manager.on('participants-updated', (participants: string[]) => {
          console.log('Participants updated:', participants);
        });

        await manager.connect(currentUser.id, session.access_token);
        setIsConnected(true);
      } catch (err) {
        console.error('Failed to initialize WebRTC:', err);
        setError('Failed to initialize voice connection');
      }
    };

    initWebRTC();

    return () => {
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.disconnect();
      }
    };
  }, [currentUser]);

  // Join voice room
  const handleJoinCall = useCallback(async () => {
    if (!webrtcManagerRef.current || !isConnected) return;

    try {
      // Validate access first
      const accessResult = await new Promise<{ hasAccess: boolean }>((resolve, reject) => {
        validateAccess({ roomId: groupId }, {
          onSuccess: resolve,
          onError: reject,
        });
      });
      if (!accessResult.hasAccess) {
        setError('Access denied to voice room');
        return;
      }

      await webrtcManagerRef.current.joinRoom(groupId);
      setIsInCall(true);
      setError(null);
    } catch (err) {
      console.error('Failed to join call:', err);
      setError('Failed to join voice call');
    }
  }, [groupId, isConnected, validateAccess]);

  // Leave voice room
  const handleLeaveCall = useCallback(() => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.leaveRoom();
    }
    setIsInCall(false);
    setRemoteStreams(new Map());
    onLeave?.();
  }, [onLeave]);

  // Toggle mute
  const handleToggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.toggleAudio(newMuted);
    }
  }, [isMuted]);

  // Set up local video
  useEffect(() => {
    if (webrtcManagerRef.current && localVideoRef.current) {
      const localStream = webrtcManagerRef.current.getLocalStream();
      if (localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  }, [isInCall]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">{groupName}</h3>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className={cn(
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-green-500' : 'bg-red-500'
          )} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!isInCall ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="mb-6 p-8 bg-muted/30 rounded-2xl">
              <Volume2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Join Voice Call</h2>
              <p className="text-muted-foreground mb-6">
                Connect with others in {groupName}
              </p>
            </div>

            <button
              onClick={handleJoinCall}
              disabled={!isConnected}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                isConnected
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              <Phone className="h-4 w-4" />
              {isConnected ? 'Join Call' : 'Connecting...'}
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl"
          >
            {/* Video Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Local Video */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-white text-sm">
                  You {isMuted && '(Muted)'}
                </div>
              </div>

              {/* Remote Videos */}
              {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
                <div key={userId} className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={(el) => {
                      if (el) {
                        remoteVideoRefs.current.set(userId, el);
                        el.srcObject = stream;
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-white text-sm">
                    User {userId.slice(-4)}
                  </div>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleToggleMute}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                  isMuted
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>

              <button
                onClick={handleLeaveCall}
                className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-all"
              >
                <PhoneOff className="h-4 w-4" />
                Leave Call
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
