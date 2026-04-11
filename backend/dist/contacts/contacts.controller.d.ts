import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto/contacts.dto';
export declare class ContactsController {
    private readonly contactsService;
    constructor(contactsService: ContactsService);
    findAll(req: any): Promise<any[]>;
    create(req: any, createContactDto: CreateContactDto): Promise<any>;
    update(req: any, contactId: string, updateContactDto: UpdateContactDto): Promise<any>;
    block(req: any, contactId: string, is_blocked: boolean): Promise<any>;
    archive(req: any, contactId: string, is_archived: boolean): Promise<any>;
    favorite(req: any, contactId: string, is_favorite: boolean): Promise<any>;
    pin(req: any, contactId: string, is_pinned: boolean): Promise<any>;
    mute(req: any, contactId: string, is_muted: boolean): Promise<any>;
    remove(req: any, contactId: string): Promise<{
        success: boolean;
    }>;
}
