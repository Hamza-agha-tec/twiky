import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  authenticate(){
    return 'Hello World!';
  }
  getUser(){
    return 'Hello World!';
  }
  signout(){
    return 'Hello World!';
  }
}
