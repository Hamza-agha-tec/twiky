import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { GroupsModule } from '../groups/groups.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
    imports: [SupabaseModule, NotificationsModule, GroupsModule, MessagingModule],
    controllers: [InvitationsController],
    providers: [InvitationsService],
    exports: [InvitationsService],
})
export class InvitationsModule { }
