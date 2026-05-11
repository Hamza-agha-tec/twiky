export class CreateGroupDto {
    name: string;
    description?: string;
    is_general?: boolean;
    group_type?: 'text' | 'voice' | 'watch';
    access_type?: 'PUBLIC' | 'PRIVATE';
}
