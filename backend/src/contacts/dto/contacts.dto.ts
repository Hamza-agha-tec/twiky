export class CreateContactDto {
  phoneNumber: string;
  nickname?: string;
}

export class UpdateContactDto {
  nickname?: string;
  is_blocked?: boolean;
  is_archived?: boolean;
  is_favorite?: boolean;
  is_pinned?: boolean;
  is_muted?: boolean;
}
