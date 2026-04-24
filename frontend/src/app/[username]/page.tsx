'use client'

import { useParams, useRouter } from 'next/navigation'
import { useProfile, useUserByUsername, useUserPosts, useUserFollowers, useUserFollowing, useSendFollowRequest } from '@/hooks/use-user'
import { IconRail, type ActiveView } from '@/components/chat/icon-rail'
import { useNotifications } from '@/hooks/use-notifications'
import { useState } from 'react'
import { ArrowLeft, Globe, ImageIcon, MessageSquare } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'

function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function formatPostTime(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const username = typeof params?.username === 'string' ? params.username : ''

  const { data: currentUser } = useProfile()
  const { data: allNotifications = [] } = useNotifications()
  const unreadNotificationCount = allNotifications.filter((n) => !n.is_read && n.type !== 'MENTION').length

  const userInitial = currentUser?.fullname?.charAt(0).toUpperCase() ?? currentUser?.username?.charAt(0).toUpperCase() ?? '?'
  const userAvatar = currentUser?.avatar_url

  const { data: profile, isLoading, isError } = useUserByUsername(username)
  const { data: posts = [] } = useUserPosts(profile?.id)
  const { data: followersData = [] } = useUserFollowers(profile?.id)
  const { data: followingData = [] } = useUserFollowing(profile?.id)
  const sendFollowRequest = useSendFollowRequest()
  const [followRequested, setFollowRequested] = useState(false)
  const [tab, setTab] = useState<'posts' | 'about'>('posts')
  const [followListView, setFollowListView] = useState<'followers' | 'following' | null>(null)

  const isOwn = currentUser?.id === profile?.id
  const isAlreadyFollowing = followersData.some(
    (f) => f.follower_id === currentUser?.id || (f as any).users?.id === currentUser?.id
  )

  const handleAvatarClick = () => router.push('/settings/profile')
  const handleViewChange = (view: ActiveView) => {
    if (view === 'settings') router.push('/settings/account')
    else router.push('/chat')
  }

  async function handleFollow() {
    if (!profile?.id) return
    try {
      await sendFollowRequest.mutateAsync(profile.id)
      setFollowRequested(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send follow request')
    }
  }

  const Rail = (
    <IconRail
      activeView="chat"
      onViewChange={handleViewChange}
      onAvatarClick={handleAvatarClick}
      userInitial={userInitial}
      userAvatar={userAvatar}
      notificationCount={unreadNotificationCount}
    />
  )

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {Rail}
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (isError || !profile) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {Rail}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <h2 className="text-xl font-bold text-foreground">User not found</h2>
          <p className="text-sm text-muted-foreground">@{username} does not exist or could not be loaded.</p>
          <button onClick={() => router.back()} className="mt-2 flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Go back
          </button>
        </div>
      </div>
    )
  }

  const displayName = profile.fullname ?? profile.username ?? 'Unknown'
  const handle = profile.username ?? 'unknown'
  const initial = displayName.charAt(0).toUpperCase()

  // Follow/unfollow list view
  if (followListView !== null) {
    const listTitle = followListView === 'followers' ? 'Followers' : 'Following'
    const listUsers = followListView === 'followers'
      ? followersData.map((r) => ({ id: r.follower_id, user: (r as any).users }))
      : followingData.map((r) => ({ id: r.following_id, user: (r as any).users }))

    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {Rail}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-6 py-4">
            <button onClick={() => setFollowListView(null)} className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-[15px] font-semibold text-foreground">{listTitle}</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{listUsers.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {listUsers.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-center text-muted-foreground">
                <p className="text-sm">No {listTitle.toLowerCase()} yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {listUsers.map(({ id, user }) => {
                  const u = user ?? {}
                  const uName = u.fullname ?? u.username ?? id
                  const uInitial = uName.charAt(0).toUpperCase()
                  return (
                    <div key={id} className="flex items-center gap-4 px-6 py-3">
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt={uName} className="h-full w-full object-cover" />
                          : <div className="flex h-full w-full items-center justify-center text-[13px] font-bold text-foreground">{uInitial}</div>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-foreground">{uName}</p>
                        {u.username ? <p className="text-[12px] text-muted-foreground">@{u.username}</p> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {Rail}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Banner */}
        <div className="relative h-48 flex-shrink-0 overflow-hidden bg-gradient-to-br from-primary via-primary/70 to-primary/40">
          {profile.banner
            ? <img src={profile.banner} alt="" className="h-full w-full object-cover" />
            : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/50" />
          <button
            onClick={() => router.back()}
            className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/55"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Profile info header */}
        <div className="flex-shrink-0 border-b border-border bg-card px-8 pb-0">
          <div className="-mt-14 flex items-end justify-between pb-4">
            <Avatar className="h-24 w-24 overflow-hidden rounded-full border-4 border-card bg-muted shadow-xl">
              <AvatarImage src={profile.avatar_url ?? undefined} alt={displayName} className="h-full w-full object-cover" />
              <AvatarFallback className="rounded-full bg-muted text-2xl font-bold text-foreground">{initial}</AvatarFallback>
            </Avatar>

            {/* Actions */}
            <div className="flex items-center gap-2 pb-1">
              {!isOwn && (
                <>
                  <button
                    onClick={() => {}}
                    className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-transparent px-4 text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Message
                  </button>
                  {!isAlreadyFollowing && !followRequested && (
                    <button
                      onClick={handleFollow}
                      disabled={sendFollowRequest.isPending}
                      className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-5 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      Follow
                    </button>
                  )}
                  {(isAlreadyFollowing || followRequested) && (
                    <span className="flex h-9 items-center rounded-xl border border-border bg-muted px-5 text-[13px] font-medium text-muted-foreground">
                      {followRequested ? 'Requested' : 'Following'}
                    </span>
                  )}
                </>
              )}
              {isOwn && (
                <button
                  onClick={() => router.push('/settings/profile')}
                  className="flex h-9 items-center rounded-xl border border-border bg-transparent px-4 text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Edit profile
                </button>
              )}
            </div>
          </div>

          {/* Name & handle */}
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-foreground">{displayName}</h1>
              {profile.is_verified && (
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="flex-shrink-0 text-primary">
                  <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15" />
                  <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground">@{handle}</p>
            {profile.bio && <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-foreground">{profile.bio}</p>}
            {profile.website_url && (
              <a
                href={profile.website_url.startsWith('http') ? profile.website_url : `https://${profile.website_url}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 flex items-center gap-1.5 text-[13px] text-primary hover:underline w-fit"
              >
                <Globe className="h-3.5 w-3.5" />
                {profile.website_url.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 py-3">
            <button onClick={() => setFollowListView('followers')} className="group text-left">
              <span className="text-[15px] font-bold text-foreground">{formatCount(followersData.length)}</span>
              <span className="ml-1.5 text-[13px] text-muted-foreground group-hover:text-foreground">Followers</span>
            </button>
            <button onClick={() => setFollowListView('following')} className="group text-left">
              <span className="text-[15px] font-bold text-foreground">{formatCount(followingData.length)}</span>
              <span className="ml-1.5 text-[13px] text-muted-foreground group-hover:text-foreground">Following</span>
            </button>
            <div>
              <span className="text-[15px] font-bold text-foreground">{formatCount(posts.length)}</span>
              <span className="ml-1.5 text-[13px] text-muted-foreground">Posts</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {(['posts', 'about'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-semibold capitalize transition-colors ${
                  tab === t
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto bg-background px-8 py-6">
          {tab === 'posts' && (
            <div className="mx-auto max-w-2xl space-y-4">
              {posts.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                  <ImageIcon className="mb-4 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-[15px] font-semibold text-foreground">No posts yet</p>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">
                    {isOwn ? "You haven't posted anything yet." : `@${handle} hasn't posted yet.`}
                  </p>
                </div>
              ) : (
                posts.map((post) => (
                  <article key={post.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 rounded-full border border-border bg-muted">
                          <AvatarImage src={profile.avatar_url ?? undefined} alt={displayName} />
                          <AvatarFallback className="rounded-full bg-muted text-[11px] font-bold">{initial}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">{displayName}</p>
                          <p className="text-[11px] text-muted-foreground">{formatPostTime(post.created_at)}</p>
                        </div>
                      </div>
                      {post.caption && <p className="mt-3 text-[14px] leading-relaxed text-foreground">{post.caption}</p>}
                    </div>
                    {post.media_urls && post.media_urls.length > 0 && (
                      <div className="overflow-hidden border-t border-border">
                        <img src={post.media_urls[0]} alt="" className="max-h-[400px] w-full object-cover" />
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          )}

          {tab === 'about' && (
            <div className="mx-auto max-w-2xl space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">About</h2>
                <p className="text-[14px] leading-relaxed text-foreground">{profile.bio ?? 'No bio yet.'}</p>

                {profile.website_url && (
                  <div className="flex items-center gap-2 text-[13px]">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={profile.website_url.startsWith('http') ? profile.website_url : `https://${profile.website_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {profile.website_url.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}

                {profile.x_url && (
                  <div className="flex items-center gap-2 text-[13px]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-muted-foreground">
                      <path d="M18.244 2H21l-6.02 6.879L22 22h-5.49l-4.3-7.98L5.23 22H2.47l6.44-7.36L2 2h5.63l3.89 7.27L18.244 2Zm-.96 18h1.52L6.8 3.9H5.17l12.114 16.1Z" />
                    </svg>
                    <a href={profile.x_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {profile.x_url.replace(/^https?:\/\/(www\.)?x\.com\//, '@')}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  <span>Joined {new Date(profile.created_at).toLocaleDateString('en', { month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
