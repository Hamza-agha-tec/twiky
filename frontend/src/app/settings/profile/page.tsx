'use client'

import { ProfileSection } from '@/components/settings/sections/profile-section'
import { useProfile, useUserFollowers, useUserFollowing, useUserPosts } from '@/hooks/use-user'

export default function ProfilePage() {
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: followers = [] } = useUserFollowers(profile?.id)
  const { data: following = [] } = useUserFollowing(profile?.id)
  const { data: posts = [] } = useUserPosts(profile?.id)
  
  return (
    <ProfileSection 
      avatarUrl={profile?.avatar_url ?? null}
      bannerUrl={profile?.banner ?? null}
      followersCount={followers.length}
      followingCount={following.length}
      posts={posts}
      profile={profile}
      profileLoading={profileLoading}
      onAvatarChange={() => {}}
      onBannerChange={() => {}}
    />
  )
}
