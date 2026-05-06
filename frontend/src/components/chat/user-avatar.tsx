'use client';

const DEFAULT = '/defaultprofile.jpg';

interface UserAvatarProps {
  src?: string | null;
  alt?: string;
  className?: string;
  size?: number;
}

export function UserAvatar({ src, alt = '', className = '' }: UserAvatarProps) {
  return (
    <img
      src={src || DEFAULT}
      alt={alt}
      className={className}
      onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT; }}
    />
  );
}
