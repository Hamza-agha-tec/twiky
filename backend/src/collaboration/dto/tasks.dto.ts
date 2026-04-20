import { IsString, IsOptional, IsUUID, IsArray, IsEnum } from 'class-validator';

export class CreateTaskDto {
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsUUID()
    groupId?: string;

    @IsOptional()
    @IsUUID()
    assigneeId?: string;

    @IsOptional()
    @IsString()
    dueDate?: string;

    @IsOptional()
    @IsEnum(['low', 'medium', 'high'])
    priority?: 'low' | 'medium' | 'high';

    @IsOptional()
    @IsArray()
    tags?: string[];

    @IsOptional()
    @IsArray()
    attachments?: any[]; // jsonb
}

export class UpdateTaskDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString() // Typically an ENUM string like 'TODO', 'IN_PROGRESS', 'DONE'
    status?: string;

    @IsOptional()
    @IsUUID()
    assigneeId?: string;

    @IsOptional()
    @IsString()
    dueDate?: string;

    @IsOptional()
    @IsEnum(['low', 'medium', 'high'])
    priority?: 'low' | 'medium' | 'high';

    @IsOptional()
    @IsArray()
    tags?: string[];

    @IsOptional()
    @IsArray()
    attachments?: any[]; // jsonb
}
