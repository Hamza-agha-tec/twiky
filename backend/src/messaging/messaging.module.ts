import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { DirectMessagingController } from './direct-messaging.controller';
import { GroupMessagingController } from './group-messaging.controller';
import { ChatGateway } from './gateway/chat.gateway';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [DirectMessagingController, GroupMessagingController],
  providers: [MessagingService, ChatGateway],
  exports: [MessagingService],
})
export class MessagingModule {}
