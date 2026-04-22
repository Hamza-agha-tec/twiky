import { IsEnum, IsUUID } from 'class-validator';

export enum InvitationStatus {
    ACCEPTED = 'ACCEPTED',
    REJECTED = 'REJECTED',
}

export class RespondInvitationDto {
    @IsUUID()
    invitationId: string;

    @IsEnum(InvitationStatus)
    status: InvitationStatus;
}

export class CreateInvitationDto {
    @IsUUID()
    inviteeId: string;

    @IsEnum(['CHANNEL', 'GROUP', 'FOLLOW'])
    entityType: 'CHANNEL' | 'GROUP' | 'FOLLOW';

    @IsUUID()
    entityId: string;
}
