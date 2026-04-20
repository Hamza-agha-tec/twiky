import { IsString, IsOptional, IsUUID, IsNumber, IsEnum, IsArray } from 'class-validator';

export class CreateGoalDto {
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsUUID()
    groupId?: string;

    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @IsString()
    targetDate?: string;

    @IsOptional()
    @IsEnum(['low', 'medium', 'high'])
    priority?: 'low' | 'medium' | 'high';
}

export class UpdateGoalDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsNumber()
    progress?: number;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsArray()
    milestones?: any[]; // jsonb fallback
}

export class CreateMilestoneDto {
    @IsString()
    milestoneId: string;

    @IsString()
    title: string;
}

export class GoalNoteDto {
    @IsString()
    title: string;

    @IsString()
    content: string;

    @IsOptional()
    @IsNumber()
    progressPoint?: number;

    @IsOptional()
    @IsString()
    milestone?: string;

    @IsOptional()
    @IsString()
    color?: string;
}
