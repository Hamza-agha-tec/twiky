import { ChannelAccess } from '../enums/channel-access.enum';

export class CreateChannelDto {
    name: string;
    description?: string;
    avatar_url?: string;
    banner_url?: string;
    access_type?: ChannelAccess;
    type?: 'NORMAL' | 'WORKSPACE';
}
