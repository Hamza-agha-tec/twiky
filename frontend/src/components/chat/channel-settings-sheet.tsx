'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  Archive,
  Globe,
  Lock,
  Search,
  Trash2,
  Upload,
  UserPlus,
  UserX,
  X,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/chat/user-avatar'
import {
  useUpdateChannel,
  useDeleteChannel,
  useChannelMembers,
  useChannelJoinRequests,
  useAddChannelMember,
  useKickChannelMember,
  useRespondToChannelJoinRequest,
} from '@/hooks/use-channels';
import { useProfile, useSearchUsers } from '@/hooks/use-user';
import { filesApi } from '@/lib/files-api';
import { toast } from 'sonner';
import { getChannelTone, getChannelMonogram, versionedAssetUrl } from '@/lib/channel-utils';

const BANNER_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml'

export interface WorkspaceChannel {
  id: string
  label: string
  description: string
  avatarUrl?: string
  bannerUrl?: string
  access_type: 'PUBLIC' | 'PRIVATE'
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  owner_id: string
  type: 'WORKSPACE' | 'NORMAL'
}

export function ChannelSettingsSheet({
  channel,
  open,
  onOpenChange,
  onSave,
  onDeleted,
}: {
  channel: WorkspaceChannel
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (avatarUrl: string | null, bannerUrl: string | null) => void
  onDeleted?: () => void
}) {
  const [name, setName] = useState(channel.label)
  const [description, setDescription] = useState(channel.description)
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [notifications, setNotifications] = useState(true)
  const [muteAll, setMuteAll] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null)
  const [kickingMemberId, setKickingMemberId] = useState<string | null>(null)
  const updateChannel = useUpdateChannel()
  const deleteChannel = useDeleteChannel()
  const { data: currentProfile } = useProfile()
  const isAdmin = channel.role === 'OWNER' || channel.role === 'ADMIN' || (!!currentProfile?.id && channel.owner_id === currentProfile.id)
  const { data: channelMembers = [] } = useChannelMembers(isAdmin ? channel.id : undefined)
  const { data: channelJoinRequests = [] } = useChannelJoinRequests(
    isAdmin && channel.access_type === 'PRIVATE' ? channel.id : undefined,
  )
  const addChannelMember = useAddChannelMember(channel.id)
  const kickChannelMember = useKickChannelMember(channel.id)
  const respondToRequest = useRespondToChannelJoinRequest(channel.id)
  const { data: searchResults = [] } = useSearchUsers(memberSearch.trim())
  const [bannerUrl, setBannerUrl] = useState<string | null>(channel.bannerUrl ?? null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(channel.avatarUrl ?? null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const blobUrlsRef = useRef<string[]>([])
  const bannerRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      blobUrlsRef.current = []
    }
  }, [])

  useEffect(() => {
    blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    blobUrlsRef.current = []
    setName(channel.label)
    setDescription(channel.description)
    setVisibility(channel.access_type === 'PRIVATE' ? 'private' : 'public')
    setNotifications(true)
    setMuteAll(false)
    setSaveError(null)
    setDeleteConfirm(false)
    setBannerUrl(channel.bannerUrl ?? null)
    setAvatarUrl(channel.avatarUrl ?? null)
    setBannerFile(null)
    setAvatarFile(null)
  }, [channel.avatarUrl, channel.bannerUrl, channel.description, channel.id, channel.label])

  function handleBannerChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    blobUrlsRef.current.push(url)
    setBannerFile(file)
    setBannerUrl(url)
  }

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    blobUrlsRef.current.push(url)
    setAvatarFile(file)
    setAvatarUrl(url)
  }

  const tone = getChannelTone(channel.id)
  const monogram = getChannelMonogram(name || channel.label)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] overflow-y-auto p-0 sm:max-w-[360px]">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-[13px]">Channel Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-0 divide-y divide-border">
          {/* Banner + Avatar */}
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Appearance
            </p>

            {/* Banner */}
            <div
              className="relative h-24 w-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-muted"
              onClick={() => bannerRef.current?.click()}
            >
              {bannerUrl ? (
                <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
              ) : (
                <div className={cn('h-full w-full bg-gradient-to-br opacity-60', tone)} />
              )}
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                <Upload className="h-4 w-4 text-white" />
                <span className="text-[11px] font-medium text-white">Upload GIF or image banner</span>
              </div>
              <input ref={bannerRef} type="file" accept={BANNER_ACCEPT} className="hidden" onChange={handleBannerChange} />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Banners support PNG, JPG, WEBP, SVG, and animated GIF up to 20 MB.
            </p>

            {/* Avatar */}
            <div className="flex items-center gap-3">
              <div
                className="relative h-14 w-14 cursor-pointer flex-shrink-0 overflow-hidden rounded-2xl"
                onClick={() => avatarRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br text-[14px] font-bold text-white', tone)}>
                    {monogram}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                  <Upload className="h-3.5 w-3.5 text-white" />
                </div>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <div>
                <p className="text-[12px] font-medium text-foreground">Channel avatar</p>
                <p className="text-[11px] text-muted-foreground">Click avatar to change. 256×256 min.</p>
              </div>
            </div>
          </div>

          {/* General */}
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              General
            </p>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Channel name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 rounded-xl text-[12px]"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[72px] rounded-xl text-[12px] leading-5"
                disabled={!isAdmin}
              />
            </div>
          </div>

          {/* Access */}
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Access
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['public', 'private'] as const).map((vis) => (
                <button
                  key={vis}
                  disabled={!isAdmin}
                  onClick={() => setVisibility(vis)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-colors',
                    visibility === vis
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent',
                    !isAdmin && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {vis === 'public' ? (
                    <Globe className="h-4 w-4 text-primary" />
                  ) : (
                    <Lock className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-[11px] font-semibold capitalize text-foreground">{vis}</span>
                  <span className="text-[10px] leading-4 text-muted-foreground">
                    {vis === 'public' ? 'Anyone can find and join' : 'Invite-only access'}
                  </span>
                </button>
              ))}
            </div>
          </div>


          {/* Notifications */}
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Notifications
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-foreground">All notifications</p>
                <p className="text-[11px] text-muted-foreground">Get notified for every message</p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-foreground">Mute channel</p>
                <p className="text-[11px] text-muted-foreground">Silence all activity here</p>
              </div>
              <Switch checked={muteAll} onCheckedChange={setMuteAll} />
            </div>
          </div>

          {/* Join Requests — private channels, admins only */}
          {isAdmin && channel.access_type === 'PRIVATE' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Join Requests
                </p>
                {channelJoinRequests.length > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {channelJoinRequests.length}
                  </span>
                )}
              </div>
              {channelJoinRequests.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No pending requests</p>
              ) : (
                <div className="space-y-2">
                  {channelJoinRequests.map((req) => (
                    <div key={req.id} className="flex items-center gap-2.5 rounded-2xl border border-border bg-muted/30 px-3 py-2.5">
                      <UserAvatar src={req.user?.avatar_url} alt={req.user?.username ?? ''} className="h-7 w-7 shrink-0 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-foreground">
                          @{req.user?.username ?? 'Unknown'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => respondToRequest.mutate({ requestId: req.id, status: 'ACCEPTED' })}
                          disabled={respondToRequest.isPending}
                          className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => respondToRequest.mutate({ requestId: req.id, status: 'REJECTED' })}
                          disabled={respondToRequest.isPending}
                          className="rounded-lg bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-accent disabled:opacity-50"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Members — admins only */}
          {isAdmin && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Members
                </p>
                <span className="text-[10px] text-muted-foreground">{channelMembers.length}</span>
              </div>

              {/* Add member search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Add member by username…"
                  className="h-8 rounded-xl pl-8 text-[12px]"
                />
                {memberSearch && (
                  <button
                    onClick={() => setMemberSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Search results */}
              {memberSearch.trim() && searchResults.length > 0 && (
                <div className="rounded-xl border border-border bg-background shadow-lg">
                  {searchResults.slice(0, 5).map((u) => {
                    const alreadyMember = channelMembers.some((m) => m.user?.id === u.id)
                    return (
                      <div key={u.id} className="flex items-center gap-2.5 border-b border-border px-3 py-2 last:border-0">
                        <UserAvatar src={u.avatar_url} alt={u.username} className="h-6 w-6 rounded-full object-cover" />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">@{u.username}</span>
                        {alreadyMember ? (
                          <span className="text-[10px] text-muted-foreground">Member</span>
                        ) : (
                          <button
                            disabled={addingMemberId === u.id}
                            onClick={async () => {
                              setAddingMemberId(u.id)
                              try {
                                await addChannelMember.mutateAsync({ userId: u.id })
                                setMemberSearch('')
                                toast.success(`@${u.username} added`)
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : 'Failed to add member')
                              } finally {
                                setAddingMemberId(null)
                              }
                            }}
                            className="flex items-center gap-1 rounded-lg bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            <UserPlus className="h-3 w-3" />
                            Add
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Member list */}
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {channelMembers.map((m) => (
                  <div key={m.user?.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-accent/50">
                    <UserAvatar src={m.user?.avatar_url} alt={m.user?.username ?? ''} className="h-6 w-6 rounded-full object-cover" />
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-[12px] text-foreground">@{m.user?.username ?? 'Unknown'}</span>
                    </div>
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                      {m.role.toLowerCase()}
                    </span>
                    {m.role !== 'OWNER' && (
                      <button
                        disabled={kickingMemberId === m.user?.id}
                        onClick={async () => {
                          if (!m.user?.id) return
                          setKickingMemberId(m.user.id)
                          try {
                            await kickChannelMember.mutateAsync(m.user.id)
                            toast.success(`@${m.user.username} removed`)
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Failed to remove member')
                          } finally {
                            setKickingMemberId(null)
                          }
                        }}
                        className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danger zone */}
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-destructive">
              Danger zone
            </p>
            <div className="space-y-2">
              <button className="flex w-full items-center gap-2.5 rounded-2xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-accent">
                <Archive className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[12px] font-medium text-foreground">Archive channel</p>
                  <p className="text-[11px] text-muted-foreground">Read-only, hidden from sidebar</p>
                </div>
              </button>
              {deleteConfirm ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-destructive">This cannot be undone. All groups and messages will be deleted.</p>
                  <div className="flex gap-2">
                    <button
                      disabled={deleteChannel.isPending}
                      onClick={() => {
                        deleteChannel.mutate(channel.id, {
                          onSuccess: () => { onOpenChange(false); onDeleted?.() },
                          onError: (e) => setSaveError(e instanceof Error ? e.message : 'Failed to delete'),
                        })
                      }}
                      className="flex-1 rounded-xl bg-destructive px-3 py-2 text-[12px] font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {deleteChannel.isPending ? 'Deleting…' : 'Confirm delete'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="flex-1 rounded-xl border border-border px-3 py-2 text-[12px] font-medium hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex w-full items-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-left transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-[12px] font-medium text-destructive">Delete channel</p>
                    <p className="text-[11px] text-muted-foreground">Permanently remove all data</p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Save */}
          {isAdmin && (
            <div className="p-4 space-y-2">
              {saveError ? (
                <p className="text-[11px] text-destructive">{saveError}</p>
              ) : null}
              <Button
                className="w-full rounded-xl text-[12px]"
                disabled={updateChannel.isPending || uploadingMedia}
                onClick={async () => {
                  setSaveError(null)
                  setUploadingMedia(true)
                  try {
                    let nextAvatar = avatarUrl
                    let nextBanner = bannerUrl
                    if (avatarFile) {
                      const { publicUrl } = await filesApi.uploadChannelLogo(channel.id, avatarFile)
                      nextAvatar = versionedAssetUrl(publicUrl)
                    }
                    if (bannerFile) {
                      const { publicUrl } = await filesApi.uploadChannelBanner(channel.id, bannerFile)
                      nextBanner = versionedAssetUrl(publicUrl)
                    }
                    const data: {
                      name: string
                      description?: string
                      access_type: 'PUBLIC' | 'PRIVATE'
                      avatar_url?: string
                      banner_url?: string
                    } = {
                      name: name.trim() || channel.label,
                      description: description.trim() || undefined,
                      access_type: visibility === 'private' ? 'PRIVATE' : 'PUBLIC',
                    }
                    if (nextAvatar?.startsWith('http')) data.avatar_url = nextAvatar
                    if (nextBanner?.startsWith('http')) data.banner_url = nextBanner
                    await updateChannel.mutateAsync({ id: channel.id, data })
                    blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
                    blobUrlsRef.current = []
                    setAvatarFile(null)
                    setBannerFile(null)
                    setAvatarUrl(nextAvatar?.startsWith('http') ? nextAvatar : null)
                    setBannerUrl(nextBanner?.startsWith('http') ? nextBanner : null)
                    onSave?.(
                      nextAvatar?.startsWith('http') ? nextAvatar : null,
                      nextBanner?.startsWith('http') ? nextBanner : null,
                    )
                    onOpenChange(false)
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Failed to save'
                    setSaveError(msg)
                    toast.error(msg)
                  } finally {
                    setUploadingMedia(false)
                  }
                }}
              >
                {updateChannel.isPending || uploadingMedia ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
