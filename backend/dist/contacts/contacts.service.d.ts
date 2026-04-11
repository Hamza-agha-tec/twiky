import { SupabaseService } from '../supabase/supabase.module';
import { UsersService } from '../users/users.service';
import { CreateContactDto, UpdateContactDto } from './dto/contacts.dto';
export declare class ContactsService {
    private supabaseService;
    private usersService;
    constructor(supabaseService: SupabaseService, usersService: UsersService);
    findAll(userId: string): Promise<any[]>;
    addContact(userId: string, createContactDto: CreateContactDto): Promise<any>;
    updateContact(userId: string, contactId: string, updateContactDto: UpdateContactDto): Promise<any>;
    removeContact(userId: string, contactId: string): Promise<{
        success: boolean;
    }>;
}
