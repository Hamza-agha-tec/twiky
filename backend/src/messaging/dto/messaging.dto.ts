export class CreateConversationDto {
  isGroup?: boolean;
  name?: string; // Optional for groups
  participantIds: string[]; // List of user IDs to include
}

export class SendMessageDto {
  conversationId: string;
  content?: string;
  type?: 'text' | 'image' | 'file' | 'voice';
  fileUrl?: string;
  replyToId?: string; // ID of the message being replied to
  isForwarded?: boolean;
  metadata?: any;
}

export class EditMessageDto {
  messageId: string;
  content: string;
}

export class ToggleReactionDto {
  messageId: string;
  emoji: string;
}
