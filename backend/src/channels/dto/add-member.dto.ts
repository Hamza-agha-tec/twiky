export class AddMemberDto {
    user_id: string;
    role?: 'OWNER' | 'ADMIN' | 'MEMBER';
}
