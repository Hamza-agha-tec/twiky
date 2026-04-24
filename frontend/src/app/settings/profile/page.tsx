'use client'

import { ProfileSection } from '@/components/settings/sections/profile-section'
import { useProfile, useUserFollowers, useUserFollowing, useUserPosts } from '@/hooks/use-user'
import { isProPlan } from '@/components/chat/verified-badge'

export default function ProfilePage() {
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: followers = [] } = useUserFollowers(profile?.id)
  const { data: following = [] } = useUserFollowing(profile?.id)
  const { data: posts = [] } = useUserPosts(profile?.id)
  
  const isPro = isProPlan(profile?.sub_plan)

  return (
    <ProfileSection 
      avatarUrl={profile?.avatar_url ?? null}
      bannerUrl={profile?.banner ?? null}
      followersCount={followers.length}
      followingCount={following.length}
      isPro={isPro}
      posts={posts}
      profile={profile}
      profileLoading={profileLoading}
      onAvatarChange={() => {}}
      onBannerChange={() => {}}
    />
  )
}
