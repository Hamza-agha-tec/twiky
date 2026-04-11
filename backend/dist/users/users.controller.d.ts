import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(req: any): Promise<any>;
    updateProfile(req: any, updateData: UpdateUserDto): Promise<any>;
    getSettings(req: any): Promise<any>;
    updateSettings(req: any, updateData: UpdateSettingsDto): Promise<any>;
    search(phone: string): Promise<{
        id: any;
        username: any;
        avatar_url: any;
        phone_number: any;
    }[]>;
    getUserById(id: string): Promise<any>;
    getUsers(): Promise<any[]>;
}
