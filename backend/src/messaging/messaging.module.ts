import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { DirectMessagingController } from './direct-messaging.controller';
import { GroupMessagingController } from './group-messaging.controller';
import { ChatGateway } from './gateway/chat.gateway';
import { SupabaseModule } from '../supabase/supabase.module';
import { SpotifyModule } from '../spotify/spotify.module';

@Module({
  imports: [SupabaseModule, SpotifyModule],
  controllers: [DirectMessagingController, GroupMessagingController],
  providers: [MessagingService, ChatGateway],
  exports: [MessagingService, ChatGateway],
})
export class MessagingModule {}
