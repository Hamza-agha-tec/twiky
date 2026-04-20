export class AddGroupMemberDto {
    user_id: string;
    role?: 'ADMIN' | 'MEMBER';
}
