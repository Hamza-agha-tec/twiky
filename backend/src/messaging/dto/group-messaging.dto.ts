import { IsIn, IsInt, IsOptional, IsString, IsUUID, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EntityMentionDto {
    @IsString()
    type: string;

    @IsString()
    entityId: string;
}

export class SendGroupMessageDto {
    @IsOptional()
    @IsString()
    content?: string;

    @IsOptional()
    @IsString()
    fileUrl?: string;

    @IsOptional()
    @IsIn(['voice', 'image', 'file'])
    type?: 'voice' | 'image' | 'file';

    @IsOptional()
    @IsString()
    mime?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    duration?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
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
}
