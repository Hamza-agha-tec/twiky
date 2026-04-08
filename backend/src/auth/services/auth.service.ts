import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  authenticate() {
    return 'Authenticated!';
  }
  
  getUser() {
    return 'User Data';
  }
  
  signout() {
    return 'Signed Out!';
  }
}
