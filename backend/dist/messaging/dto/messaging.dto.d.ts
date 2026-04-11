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
    metadata?: any;
}
