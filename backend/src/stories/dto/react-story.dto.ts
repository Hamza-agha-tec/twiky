import { IsEnum } from 'class-validator';

export class ReactStoryDto {
  @IsEnum(['heart', 'fire', 'wow', 'angry', 'haha'])
  reaction: 'heart' | 'fire' | 'wow' | 'angry' | 'haha';
}
