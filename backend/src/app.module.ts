import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/controllers/auth.controller';
import { AuthService } from './auth/services/auth.service';
import { UsersModule } from './users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AppController, AuthController],
  providers: [AppService, AuthService],
})
export class AppModule { }
