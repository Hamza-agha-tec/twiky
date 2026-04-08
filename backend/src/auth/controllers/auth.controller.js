import { Controller, Delete, Get, Post } from '@nestjs/common';
import { AuthService } from '../services/auth.service.js';

@Controller()
export class AuthController {
  constructor(authService) {}

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
