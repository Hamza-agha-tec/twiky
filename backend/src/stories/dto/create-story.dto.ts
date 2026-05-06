import { IsString, IsEnum, IsOptional, IsUrl } from 'class-validator';

export class CreateStoryDto {
  @IsUrl()
  media_url: string;

  @IsEnum(['image', 'video'])
  type: string;

  @IsString()
  @IsOptional()
  caption?: string;

  @IsString()
  @IsOptional()
  music_preview_url?: string;

  @IsString()
  @IsOptional()
  music_title?: string;

  @IsString()
  @IsOptional()
  music_artist?: string;

  @IsString()
  @IsOptional()
  music_cover_url?: string;
}
