import { Module } from '@nestjs/common';
import { VoiceGateway } from './voice.gateway';
import { VoiceService } from './voice.service';
import { VoiceController } from './voice.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [VoiceController],
  providers: [VoiceGateway, VoiceService],
  exports: [VoiceGateway, VoiceService],
})
export class VoiceModule {}
