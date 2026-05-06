export class UpdateSettingsDto {
  theme?: string;
  notifications_enabled?: boolean;
  language?: string;
  accent_color?: string;
  do_not_disturb?: boolean;
  who_can_see_me_online?: string;
  who_can_see_my_last_seen?: string;
  who_can_see_my_profile_photo?: string;
  who_can_discover_me?: string;
  read_confirmation?: boolean;
  dodo_customer_id?: string;
}
