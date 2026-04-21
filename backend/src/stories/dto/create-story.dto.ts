import { IsString, IsEnum, IsOptional, IsUrl } from 'class-validator';

export class CreateStoryDto {
  @IsUrl()
  media_url: string;

  @IsEnum(['image', 'video'])
  type: string;

  @IsString()
  @IsOptional()
  caption?: string;
}
