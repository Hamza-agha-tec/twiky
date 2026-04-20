import { IsString, IsOptional, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class EntityMentionDto {
    @IsString()
    type: string;

    @IsString()
    entityId: string;
}

export class StartDirectConversationDto {
    @IsUUID()
    targetUserId: string;
}

export class SendDirectMessageDto {
    @IsString()
    content: string;

    @IsOptional()
    @IsString()
    fileUrl?: string;

    @IsOptional()
    @IsUUID()
    replyToId?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EntityMentionDto)
    entityMentions?: EntityMentionDto[];
}
