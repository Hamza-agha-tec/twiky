import { IsString, IsOptional, IsUUID, IsArray, ValidateNested, IsIn, IsNumber } from 'class-validator';
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
    @IsOptional()
    @IsString()
    content?: string;

    @IsOptional()
    @IsString()
    @IsIn(['text', 'image', 'file', 'voice'])
    type?: 'text' | 'image' | 'file' | 'voice';

    @IsOptional()
    @IsString()
    fileUrl?: string;

    @IsOptional()
    @IsString()
    mime?: string;

    @IsOptional()
    @IsNumber()
    duration?: number;

    @IsOptional()
    @IsNumber()
    size?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    fileUrls?: string[];

    @IsOptional()
    @IsUUID()
    replyToId?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EntityMentionDto)
    entityMentions?: EntityMentionDto[];

    @IsOptional()
    isForwarded?: boolean;
}
