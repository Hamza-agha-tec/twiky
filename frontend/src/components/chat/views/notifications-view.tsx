'use client'
import React, { useState } from 'react'

import { Bell, Check, UserPlus } from 'lucide-react'

import { useNotifications, useMarkAllAsRead, useMarkAsRead } from '@/hooks/use-notifications'
import { UserAvatar } from '@/components/chat/user-avatar'
import { usePendingInvitations, useRespondToInvitation } from '@/hooks/use-invitations'
import { useSendFollowRequest, useProfile, useUserFollowing } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'

function formatTime(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function notificationLabel(type: string) {
  const t = type.toUpperCase();
  switch (t) {
    case 'FOLLOW': return 'started following you'
    case 'INVITATION': return 'sent you an invitation'
    case 'INVITATION_ACCEPTED': return 'accepted your invitation'
    case 'INVITATION_REJECTED': return 'declined your invitation'
    case 'LIKE': return 'liked your post'
    case 'MENTION': return 'mentioned you'
    default: return type.toLowerCase().replace(/_/g, ' ')
  }
}

export function NotificationsView({ onAcceptGroupInvitation }: { onAcceptGroupInvitation?: (groupId: string) => void }) {
  const { data: profile } = useProfile()
  const { data: notifications = [], isLoading } = useNotifications()
  const { data: invitations = [] } = usePendingInvitations()
  const { data: following = [] } = useUserFollowing(profile?.id)
  const followingIds = new Set(following.map(f => f.following_id))

  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()
  const respondToInvitation = useRespondToInvitation()

  const displayNotifications = notifications || []
  const unreadCount = displayNotifications.filter((n) => !n.is_read).length || 0
  const followInvitations = invitations?.filter((inv) => inv.entity_type === 'FOLLOW') || []
  const groupInvitations = invitations?.filter((inv) => inv.entity_type === 'GROUP') || []
  const channelInvitations = invitations?.filter((inv) => inv.entity_type === 'CHANNEL') || []

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/10 via-background to-background px-8 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Bell className="h-5 w-5" />
                <span className="text-[11px] font-bold uppercase tracking-widest">Notifications</span>
              </div>
              <h1 className="mt-2 text-[28px] font-black tracking-tight text-foreground">Activity</h1>
              <p className="mt-2 text-[14px] text-muted-foreground">Follow requests and account activity.</p>
            </div>
            {unreadCount > 0 ? (
              <button
                onClick={() => markAllAsRead.mutate()}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Check className="h-3.5 w-3.5" />
                Mark all read
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-8 px-8 py-8">
        {groupInvitations.length > 0 ? (
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Group Invitations · {groupInvitations.length}
            </p>
            <div className="flex flex-col gap-3">
              {groupInvitations.map((inv) => (
                <InvitationRow key={inv.id} inv={inv} label={`invited you to a group · ${formatTime(inv.created_at)}`} onRespond={respondToInvitation.mutate} pending={respondToInvitation.isPending} onAccepted={() => onAcceptGroupInvitation?.(inv.entity_id)} />
              ))}
            </div>
          </div>
        ) : null}

        {channelInvitations.length > 0 ? (
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Channel Invitations · {channelInvitations.length}
            </p>
            <div className="flex flex-col gap-3">
              {channelInvitations.map((inv) => (
                <InvitationRow key={inv.id} inv={inv} label={`invited you to a channel · ${formatTime(inv.created_at)}`} onRespond={respondToInvitation.mutate} pending={respondToInvitation.isPending} />
              ))}
            </div>
          </div>
        ) : null}

        {followInvitations.length > 0 ? (
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Follow Requests · {followInvitations.length}
            </p>
            <div className="flex flex-col gap-3">
              {followInvitations.map((inv) => (
                <InvitationRow key={inv.id} inv={inv} label={`wants to follow you · ${formatTime(inv.created_at)}`} onRespond={respondToInvitation.mutate} pending={respondToInvitation.isPending} />
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Recent</p>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : displayNotifications.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
                <Bell className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-[15px] font-semibold text-foreground">No notifications yet</p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">Activity will show up here.</p>
            </div>
          ) : (
                <div className="flex flex-col gap-3">
                  {displayNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => !notif.is_read && markAsRead.mutate(notif.id)}
                      className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 transition-all hover:bg-accent/50 cursor-pointer ${!notif.is_read ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'}`}
                    >
                  <div className="flex items-center gap-3">
                    <UserAvatar src={notif.actor.avatar_url} alt={notif.actor.username} className="h-10 w-10 flex-shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-foreground">
                        <span className="font-semibold">@{notif.actor.username}</span>{' '}
                        {notificationLabel(notif.type)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{formatTime(notif.created_at)}</p>
                    </div>
                    {!notif.is_read ? (
                      <button 
                        onClick={() => markAsRead.mutate(notif.id)}
                        className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" 
                      />
                    ) : null}
                  </div>

                  {notif.type.toUpperCase() === 'FOLLOW' && 
                   !!notif.metadata?.can_follow_back && 
                   !followingIds.has(notif.actor_id) && (
                    <div className="flex pl-[52px]">
                      <FollowBackButton 
                        userId={notif.actor_id} 
                        notificationId={notif.id} 
                        onFollowed={() => {
                          if (!notif.is_read) markAsRead.mutate(notif.id)
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FollowBackButton({ userId, notificationId, onFollowed }: { userId: string, notificationId: string, onFollowed: () => void }) {
  const follow = useSendFollowRequest()
  const [followed, setFollowed] = useState(false)

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await follow.mutateAsync(userId)
      setFollowed(true)
      onFollowed()
    } catch (error) {
      console.error('Failed to follow back:', error)
    }
  }

  if (followed) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary">
        <Check className="h-3 w-3" />
        Following
      </div>
    )
  }

  return (
    <Button
      size="sm"
      onClick={handleFollow}
      disabled={follow.isPending}
      className="h-8 rounded-lg text-[10px] font-black uppercase tracking-wider"
    >
      <UserPlus className="mr-1.5 h-3 w-3" />
      Follow Back
    </Button>
  )
}

function InvitationRow({
  inv,
  label,
  pending,
  onRespond,
  onAccepted,
}: {
  inv: {
    id: string
    entity_id: string
    created_at: string
    inviter: { username: string; avatar_url?: string | null }
  }
  label: string
  pending: boolean
  onRespond: (vars: { invitationId: string; status: 'ACCEPTED' | 'REJECTED' }) => void
  onAccepted?: () => void
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
      <UserAvatar src={inv.inviter.avatar_url} alt={inv.inviter.username} className="h-11 w-11 flex-shrink-0 rounded-2xl object-cover" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-foreground">@{inv.inviter.username}</p>
        <p className="text-[12px] text-muted-foreground">{label}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { onRespond({ invitationId: inv.id, status: 'ACCEPTED' }); onAccepted?.() }}
          disabled={pending}
          className="rounded-xl bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Accept
        </button>
        <button
          onClick={() => onRespond({ invitationId: inv.id, status: 'REJECTED' })}
          disabled={pending}
          className="rounded-xl border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  )
}
