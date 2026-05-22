'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronRight, Check, Send, Mic, PhoneCall } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useChannels } from '@/hooks/use-channels'
import { useDirectConversations, useCreateDirectConversation } from '@/hooks/use-direct-conversations'
import { useProfile } from '@/hooks/use-user'
import { groupsApi, type BackendGroup } from '@/lib/groups-api'
import { directConversationsApi } from '@/lib/direct-conversations-api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface SharePayload {
  content: string
  isForwarded?: boolean
}

interface ShareParticipant {
  id: string
  name: string
  avatarUrl?: string | null
}

interface ShareModalProps {
  open: boolean
  onClose: () => void
  payload: SharePayload
  title?: string
  participants?: ShareParticipant[]
}

type DestType = 'dm' | 'group'
interface Destination {
  type: DestType
  id: string
  label: string
  avatarUrl?: string | null
  channelName?: string
}

function StackedAvatars({ participants, max = 5 }: { participants: ShareParticipant[]; max?: number }) {
  const shown = participants.slice(0, max)
  const overflow = participants.length - shown.length
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <div
          key={p.id}
          className="relative shrink-0"
          style={{ marginLeft: i === 0 ? 0 : -7, zIndex: shown.length - i }}
          title={p.name}
        >
          <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-zinc-700 ring-2 ring-zinc-900 text-[9px] font-bold text-zinc-200">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt={p.name} className="block h-full w-full object-cover" />
            ) : (
              p.name[0]?.toUpperCase() ?? '?'
            )}
          </div>
        </div>
      ))}
      {overflow > 0 && (
        <span className="ml-1.5 text-[10px] font-semibold text-zinc-400">+{overflow}</span>
      )}
    </div>
  )
}

export function ShareModal({ open, onClose, payload, title = 'Share to…', participants }: ShareModalProps) {
  const { data: currentUser } = useProfile()
  const { data: channels = [] } = useChannels()
  const { data: dms = [] } = useDirectConversations()
  const createDM = useCreateDirectConversation()

  const [query, setQuery] = useState('')
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null)
  const [channelGroups, setChannelGroups] = useState<Record<string, BackendGroup[]>>({})
  const [loadingChannel, setLoadingChannel] = useState<string | null>(null)
  const [selected, setSelected] = useState<Destination | null>(null)
  const [sending, setSending] = useState(false)

  // Parse voice invite data if present
  const voiceInviteData = useMemo(() => {
    try {
      const parsed = JSON.parse(payload.content)
      if (parsed.__twiky_type === 'voice_invite') return parsed as { groupName: string; inviterName: string }
    } catch {}
    return null
  }, [payload.content])

  const dmItems = useMemo(() => {
    return (dms ?? []).map(conv => {
      const other = conv.user_one_id === currentUser?.id ? conv.user_two : conv.user_one
      return {
        convId: conv.id,
        otherUserId: other?.id ?? '',
        name: other?.username ?? 'Unknown',
        avatarUrl: other?.avatar_url ?? null,
      }
    }).filter(d => d.name.toLowerCase().includes(query.toLowerCase()))
  }, [dms, currentUser, query])

  const filteredChannels = useMemo(() =>
    (channels ?? []).filter(c => c.name.toLowerCase().includes(query.toLowerCase())),
    [channels, query]
  )

  async function handleExpandChannel(channelId: string) {
    if (expandedChannel === channelId) {
      setExpandedChannel(null)
      return
    }
    setExpandedChannel(channelId)
    if (!channelGroups[channelId]) {
      setLoadingChannel(channelId)
      try {
        const groups = await groupsApi.getChannelGroups(channelId)
        setChannelGroups(prev => ({ ...prev, [channelId]: groups.filter(g => g.group_type === 'text' || g.group_type === 'board') }))
      } catch {
        toast.error('Failed to load groups')
      } finally {
        setLoadingChannel(null)
      }
    }
  }

  function selectDM(item: typeof dmItems[0]) {
    setSelected({ type: 'dm', id: item.convId, label: item.name, avatarUrl: item.avatarUrl })
  }

  function selectGroup(group: BackendGroup, channelName: string) {
    setSelected({ type: 'group', id: group.id, label: `#${group.name}`, channelName, avatarUrl: null })
  }

  async function handleSend() {
    if (!selected || sending) return
    setSending(true)
    try {
      if (selected.type === 'dm') {
        await directConversationsApi.sendMessage(selected.id, {
          content: payload.content,
          isForwarded: payload.isForwarded,
        })
      } else {
        await groupsApi.sendGroupMessage(selected.id, { content: payload.content })
      }
      toast.success(`Sent to ${selected.label}`)
      onClose()
    } catch {
      toast.error('Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden rounded-2xl bg-zinc-950 border-zinc-800/60 shadow-2xl">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-zinc-800/60">
          <DialogTitle className="text-[13px] font-semibold text-zinc-100">{title}</DialogTitle>
        </DialogHeader>

        {/* Voice invite preview card */}
        {voiceInviteData && (
          <div className="px-3 pt-3 pb-0">
            <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
                <PhoneCall className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-zinc-100">{voiceInviteData.groupName}</p>
                <div className="mt-1 flex items-center gap-2">
                  {participants && participants.length > 0 ? (
                    <>
                      <StackedAvatars participants={participants} max={5} />
                      <span className="text-[10px] text-zinc-500">
                        {participants.length} {participants.length === 1 ? 'in call' : 'in call'}
                      </span>
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <Mic className="h-2.5 w-2.5" />
                      Voice call
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-400">
                LIVE
              </span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-zinc-800/40 mt-2.5">
          <div className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800/60 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search friends or channels…"
              className="flex-1 bg-transparent text-[12px] text-zinc-100 focus:outline-none placeholder:text-zinc-600"
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-[300px] overflow-y-auto">
          {/* DMs */}
          {dmItems.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Direct Messages</p>
              {dmItems.map(item => {
                const isSel = selected?.type === 'dm' && selected.id === item.convId
                return (
                  <button
                    key={item.convId}
                    onClick={() => selectDM(item)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-zinc-900',
                      isSel && 'bg-zinc-900/80'
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0 ring-1 ring-zinc-800">
                      <AvatarImage src={item.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[11px] font-bold bg-zinc-800 text-zinc-300">{item.name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-[13px] font-medium text-zinc-200">{item.name}</span>
                    {isSel && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200">
                        <Check className="h-3 w-3 text-zinc-900" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Channels */}
          {filteredChannels.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Channels</p>
              {filteredChannels.map(channel => (
                <div key={channel.id}>
                  <button
                    onClick={() => handleExpandChannel(channel.id)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-zinc-900"
                  >
                    <Avatar className="h-8 w-8 shrink-0 ring-1 ring-zinc-800">
                      <AvatarImage src={channel.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[11px] font-bold bg-zinc-800 text-zinc-300">{channel.name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-[13px] font-medium text-zinc-200">{channel.name}</span>
                    <ChevronRight className={cn('h-3.5 w-3.5 text-zinc-600 shrink-0 transition-transform', expandedChannel === channel.id && 'rotate-90')} />
                  </button>

                  {expandedChannel === channel.id && (
                    <div className="bg-zinc-900/40 py-1">
                      {loadingChannel === channel.id ? (
                        <p className="px-8 py-2 text-[11px] text-zinc-600">Loading…</p>
                      ) : (channelGroups[channel.id] ?? []).length === 0 ? (
                        <p className="px-8 py-2 text-[11px] text-zinc-600">No message groups</p>
                      ) : (
                        (channelGroups[channel.id] ?? []).map(group => {
                          const isSel = selected?.type === 'group' && selected.id === group.id
                          return (
                            <button
                              key={group.id}
                              onClick={() => selectGroup(group, channel.name)}
                              className={cn(
                                'flex w-full items-center gap-2 px-8 py-1.5 text-left transition-colors hover:bg-zinc-900',
                                isSel && 'bg-zinc-900/80'
                              )}
                            >
                              <span className="text-[12px] text-zinc-600">{group.group_type === 'board' ? 'Forum' : '#'}</span>
                              <span className="flex-1 truncate text-[12px] text-zinc-300">{group.name}</span>
                              {isSel && (
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-200">
                                  <Check className="h-2.5 w-2.5 text-zinc-900" />
                                </span>
                              )}
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {dmItems.length === 0 && filteredChannels.length === 0 && (
            <p className="px-4 py-8 text-center text-[12px] text-zinc-600">No results</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-zinc-800/60 bg-zinc-950 px-4 py-3">
          <div className="min-w-0 flex-1">
            {selected ? (
              <p className="truncate text-[12px] text-zinc-500">
                To: <span className="font-semibold text-zinc-200">{selected.channelName ? `${selected.channelName} › ${selected.label}` : selected.label}</span>
              </p>
            ) : (
              <p className="text-[12px] text-zinc-600">Select a destination</p>
            )}
          </div>
          <button
            disabled={!selected || sending}
            onClick={handleSend}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-100 px-4 py-1.5 text-[12px] font-semibold text-zinc-900 transition-all hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
          >
            <Send className="h-3 w-3" />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
