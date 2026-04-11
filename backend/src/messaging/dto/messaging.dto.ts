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
  metadata?: any;
}
