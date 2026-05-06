'use client'

import { Bell, Check } from 'lucide-react'

import { useNotifications, useMarkAllAsRead, useMarkAsRead } from '@/hooks/use-notifications'
import { UserAvatar } from '@/components/chat/user-avatar'
import { usePendingInvitations, useRespondToInvitation } from '@/hooks/use-invitations'

function formatTime(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function notificationLabel(type: string) {
  switch (type) {
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
  const { data: notifications = [], isLoading } = useNotifications()
  const { data: invitations = [] } = usePendingInvitations()
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()
  const respondToInvitation = useRespondToInvitation()

  const nonMentionNotifications = notifications.filter((n) => n.type !== 'MENTION')
  const unreadCount = nonMentionNotifications.filter((n) => !n.is_read).length
  const followInvitations = invitations.filter((inv) => inv.entity_type === 'FOLLOW')
  const groupInvitations = invitations.filter((inv) => inv.entity_type === 'GROUP')
  const channelInvitations = invitations.filter((inv) => inv.entity_type === 'CHANNEL')

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
          ) : nonMentionNotifications.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
                <Bell className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-[15px] font-semibold text-foreground">No notifications yet</p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">Activity will show up here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {nonMentionNotifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => { if (!notif.is_read) markAsRead.mutate(notif.id) }}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all hover:bg-accent ${!notif.is_read ? 'border border-primary/20 bg-primary/5' : 'border border-border bg-card'}`}
                >
                  <UserAvatar src={notif.actor.avatar_url} alt={notif.actor.username} className="h-10 w-10 flex-shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground">
                      <span className="font-semibold">@{notif.actor.username}</span>{' '}
                      {notificationLabel(notif.type)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatTime(notif.created_at)}</p>
                  </div>
                  {!notif.is_read ? <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" /> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
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
