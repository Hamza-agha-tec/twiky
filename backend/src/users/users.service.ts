import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
    getUserById(id: string): string {
        return "User " + id;
    }
    getUsers(): string {
        return "All users 2";
    }
}
