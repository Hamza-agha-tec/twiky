import { SupabaseService } from '../supabase/supabase.module';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
export declare class UsersService {
    private readonly supabaseService;
    constructor(supabaseService: SupabaseService);
    getUserById(id: string): Promise<any>;
    updateProfile(id: string, updateData: UpdateUserDto): Promise<any>;
    getSettings(userId: string): Promise<any>;
    updateSettings(userId: string, updateData: UpdateSettingsDto): Promise<any>;
    getUsers(): Promise<any[]>;
    findByPhone(phone: string): Promise<any>;
    searchByPhone(phone: string): Promise<{
        id: any;
        username: any;
        avatar_url: any;
        phone_number: any;
    }[]>;
}
