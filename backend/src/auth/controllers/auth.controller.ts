import { Controller, Delete, Get, Post } from '@nestjs/common';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  authenticate() {
    return this.authService.authenticate();
  }

  @Get()
  getUser() {
    return this.authService.getUser();
  }

  @Delete()
  signout() {
    return this.authService.signout();
  }
}
