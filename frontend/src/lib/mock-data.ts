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
  isPro?: boolean;
  isVerified?: boolean;
  pinnedMessage?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderIsPro?: boolean;
  senderIsVerified?: boolean;
  avatar?: string;
  content: string;
  type: 'text' | 'image' | 'voice' | 'video';
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
