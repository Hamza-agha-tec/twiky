export class UpdateUserDto {
  username?: string;
  avatar_url?: string;
  phone_number?: string;
  bio?: string;
  status?: string; // Free-text: e.g. "busy", "in work", "🎵 vibing"
}
