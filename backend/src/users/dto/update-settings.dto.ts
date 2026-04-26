export class UpdateSettingsDto {
  theme?: string;
  notifications_enabled?: boolean;
  language?: string;
  accent_color?: string;
  do_not_disturb?: boolean;
  who_can_see_me_online?: string;
  who_can_see_my_last_seen?: string;
  read_confirmation?: boolean;
  dodo_customer_id?: string;
}
