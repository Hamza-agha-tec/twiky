export interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  isGroup: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isOnline?: boolean;
  subPlan?: string | null;
  isVerified?: boolean;
  bannerUrl?: string | null;
  pinnedMessage?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderSubPlan?: string | null;
  senderIsVerified?: boolean;
  avatar?: string;
  content: string;
  fileUrl?: string;
  mime?: string;
  type: 'text' | 'image' | 'voice' | 'video' | 'file' | 'call';
  timestamp: string;
  isOwn: boolean;
  isRead: boolean;
  isDelivered: boolean;
  isEdited?: boolean;
  isForwarded?: boolean;
  isPinned?: boolean;
  reactions?: {
    emoji: string;
    count: number;
    reactedByMe: boolean;
  }[];
  myReaction?: string | null;
  reply?: {
    senderName: string;
    content: string;
  };
  duration?: string;
}

export const chatsData: Chat[] = [];

export const messagesData: Record<string, Message[]> = {};
