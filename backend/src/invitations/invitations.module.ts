import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [SupabaseModule, NotificationsModule],
    controllers: [InvitationsController],
    providers: [InvitationsService],
    exports: [InvitationsService],
})
export class InvitationsModule { }
