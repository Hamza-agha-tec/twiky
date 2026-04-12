export class CreateConversationDto {
  isGroup?: boolean;
  name?: string; // Optional for groups
  description?: string;
  avatarUrl?: string;
  participantIds: string[]; // List of user IDs to include
}

export class UpdateGroupDto {
  name?: string;
  description?: string;
  avatarUrl?: string;
}

export class AddParticipantsDto {
  participantIds: string[];
}

export class SendMessageDto {
  conversationId: string;
  content?: string;
  type?: 'text' | 'image' | 'file' | 'voice';
  fileUrl?: string;
  metadata?: any;
  replyToId?: string;
}
