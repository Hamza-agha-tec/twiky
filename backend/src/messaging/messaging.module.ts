import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { ConversationsController } from './conversations.controller';
import { MessagesController } from './messages.controller';
import { ChatGateway } from './gateway/chat.gateway';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ConversationsController, MessagesController],
  providers: [MessagingService, ChatGateway],
  exports: [MessagingService],
})
export class MessagingModule {}
