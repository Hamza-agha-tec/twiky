'use client';

import { io, Socket } from 'socket.io-client';

export interface WebRTCManagerEvents {
  'user-joined': (userId: string) => void;
  'user-left': (userId: string) => void;
  'user-audio-toggled': (userId: string, muted: boolean) => void;
  'user-video-toggled': (userId: string, enabled: boolean) => void;
  'signal': (signal: any, fromUserId: string) => void;
  'participants-updated': (participants: string[]) => void;
}

export class WebRTCManager {
  private socket: Socket | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private roomId: string | null = null;
  private userId: string | null = null;
  private eventListeners = new Map<keyof WebRTCManagerEvents, Function[]>();

  constructor(private serverUrl: string = 'http://localhost:3500') {}

  async connect(userId: string, token: string) {
    this.userId = userId;
    
    this.socket = io(this.serverUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Connected to voice gateway');
    });

    this.socket.on('user-joined-voice', (data) => {
      this.emit('user-joined', data.userId);
      if (data.userId !== this.userId) {
        this.createPeerConnection(data.userId);
        this.sendOffer(data.userId);
      }
    });

    this.socket.on('user-left-voice', (data) => {
      this.emit('user-left', data.userId);
      this.closePeerConnection(data.userId);
    });

    this.socket.on('voice-room-participants', (data) => {
      this.emit('participants-updated', data.participants);
      data.participants.forEach((participantId: string) => {
        if (participantId !== this.userId) {
          this.createPeerConnection(participantId);
        }
      });
    });

    this.socket.on('webrtc-signal', (data) => {
      this.handleSignal(data);
    });

    this.socket.on('user-audio-toggled', (data) => {
      this.emit('user-audio-toggled', data.userId, data.muted);
    });

    this.socket.on('user-video-toggled', (data) => {
      this.emit('user-video-toggled', data.userId, data.enabled);
    });

    this.socket.on('voice-room-error', (data) => {
      console.error('Voice room error:', data.message);
    });
  }

  async joinRoom(roomId: string) {
    if (!this.socket || !this.userId) {
      throw new Error('Not connected to voice gateway');
    }

    this.roomId = roomId;
    
    // Get local media stream
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch (error) {
      console.error('Failed to get local media:', error);
      throw error;
    }

    this.socket.emit('join-voice-room', { roomId });
  }

  async leaveRoom() {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('leave-voice-room', { roomId: this.roomId });
    
    // Clean up all peer connections
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.roomId = null;
  }

  private createPeerConnection(userId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('webrtc-signal', {
          type: 'ice-candidate',
          payload: event.candidate,
          roomId: this.roomId,
          targetUserId: userId,
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      // This will be handled by the component using the WebRTCManager
      console.log('Received remote track from', userId, event.streams[0]);
    };

    this.peerConnections.set(userId, pc);
    return pc;
  }

  private async sendOffer(userId: string) {
    const pc = this.peerConnections.get(userId);
    if (!pc) return;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (this.socket) {
        this.socket.emit('webrtc-signal', {
          type: 'offer',
          payload: offer,
          roomId: this.roomId,
          targetUserId: userId,
        });
      }
    } catch (error) {
      console.error('Failed to send offer:', error);
    }
  }

  private async handleSignal(data: any) {
    const { type, payload, senderId } = data;
    const pc = this.peerConnections.get(senderId);

    if (!pc && type === 'offer') {
      // Create connection for incoming offer
      const newPc = this.createPeerConnection(senderId);
      await this.handleOffer(newPc, payload, senderId);
      return;
    }

    if (!pc) return;

    switch (type) {
      case 'offer':
        await this.handleOffer(pc, payload, senderId);
        break;
      case 'answer':
        await this.handleAnswer(pc, payload);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(pc, payload);
        break;
    }
  }

  private async handleOffer(pc: RTCPeerConnection, offer: RTCSessionDescriptionInit, fromUserId: string) {
    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (this.socket) {
        this.socket.emit('webrtc-signal', {
          type: 'answer',
          payload: answer,
          roomId: this.roomId,
          targetUserId: fromUserId,
        });
      }
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }

  private async handleAnswer(pc: RTCPeerConnection, answer: RTCSessionDescriptionInit) {
    try {
      await pc.setRemoteDescription(answer);
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }

  private async handleIceCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidateInit) {
    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  private closePeerConnection(userId: string) {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
  }

  toggleAudio(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }

    if (this.socket && this.roomId) {
      this.socket.emit('voice-room-audio-toggle', {
        roomId: this.roomId,
        muted,
      });
    }
  }

  toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }

    if (this.socket && this.roomId) {
      this.socket.emit('voice-room-video-toggle', {
        roomId: this.roomId,
        enabled,
      });
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(userId: string): MediaStream | null {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      // This is a simplified approach - in practice, you'd want to track streams better
      return null; // The component should handle this via ontrack events
    }
    return null;
  }

  on<K extends keyof WebRTCManagerEvents>(event: K, callback: WebRTCManagerEvents[K]) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off<K extends keyof WebRTCManagerEvents>(event: K, callback: WebRTCManagerEvents[K]) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit<K extends keyof WebRTCManagerEvents>(event: K, ...args: any[]) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(...args));
    }
  }

  disconnect() {
    this.leaveRoom();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.eventListeners.clear();
  }
}
