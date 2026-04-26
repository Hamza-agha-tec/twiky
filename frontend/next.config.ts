/** @type {import('next').NextConfig} */
export const nextConfig = {
  allowedDevOrigins: [
    'http://192.168.43.1:3000',
    'http://192.168.100.181:3000',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 's.gravatar.com',
      },
      {
        protocol: 'https',
        hostname: 'qmdfqlvsrpebevswmugt.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '', // This allows all HTTPS domains
      }
    ],
  },
  // Other Next.js config options can go here
};