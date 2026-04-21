import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { SpotifyController } from './spotify.controller';
import { SpotifyService } from './spotify.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [HttpModule, ConfigModule, SupabaseModule],
  controllers: [SpotifyController],
  providers: [SpotifyService],
  exports: [SpotifyService],
})
export class SpotifyModule {}
