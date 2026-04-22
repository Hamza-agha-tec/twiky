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

    @IsEnum(['CHANNEL', 'GROUP', 'FOLLOW', 'CHANNEL_JOIN_REQUEST'])
    entityType: 'CHANNEL' | 'GROUP' | 'FOLLOW' | 'CHANNEL_JOIN_REQUEST';

    @IsUUID()
    entityId: string;
}
