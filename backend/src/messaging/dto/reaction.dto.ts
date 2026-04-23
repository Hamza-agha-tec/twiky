import { IsString } from 'class-validator';

export class ToggleReactionDto {
    @IsString()
    emoji: string;
}
