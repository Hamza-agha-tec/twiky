export declare class CreateConversationDto {
    isGroup?: boolean;
    name?: string;
    participantIds: string[];
}
export declare class SendMessageDto {
    conversationId: string;
    content?: string;
    type?: 'text' | 'image' | 'file' | 'voice';
    fileUrl?: string;
    replyToId?: string;
    isForwarded?: boolean;
    metadata?: any;
}
export declare class EditMessageDto {
    messageId: string;
    content: string;
}
export declare class ToggleReactionDto {
    messageId: string;
    emoji: string;
}
