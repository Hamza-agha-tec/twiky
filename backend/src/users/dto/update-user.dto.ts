export class UpdateUserDto {
  username?: string;
  avatar_url?: string;
  phone_number?: string;
  bio?: string;
  status?: string; // Free-text: e.g. "busy", "in work", "🎵 vibing"
  banner?: string;
  full_name?: string;
  x_url?: string;
  website_url?: string;
}
