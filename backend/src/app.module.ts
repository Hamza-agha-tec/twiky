import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/controllers/auth.controller';
import { AuthService } from './auth/services/auth.service';
import { UsersModule } from './users/users.module';
import { SupabaseModule } from './supabase/supabase.module';
import { ContactsModule } from './contacts/contacts.module';
import { MessagingModule } from './messaging/messaging.module';
import { PostsModule } from './posts/posts.module';
import { ChannelsModule } from './channels/channels.module';
import { GroupsModule } from './groups/groups.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { StoriesModule } from './stories/stories.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SpotifyModule } from './spotify/spotify.module';
import { PassportModule } from '@nestjs/passport';
import { SupabaseStrategy } from './auth/strategies/supabase.strategy';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    PassportModule,
    UsersModule,
    ContactsModule,
    MessagingModule,
    PostsModule,
    ChannelsModule,
    GroupsModule,
    CollaborationModule,
    StoriesModule,
    NotificationsModule,
    SpotifyModule,
    FilesModule,
  ],
  controllers: [AppController, AuthController],
  providers: [AppService, AuthService, SupabaseStrategy],
})
export class AppModule { }
