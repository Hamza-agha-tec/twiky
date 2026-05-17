'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronRight, Check, Send } from 'lucide-react'
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

interface ShareModalProps {
  open: boolean
  onClose: () => void
  payload: SharePayload
  title?: string
}

type DestType = 'dm' | 'group'
interface Destination {
  type: DestType
  id: string           // conversationId or groupId
  label: string
  avatarUrl?: string | null
  channelName?: string
}

export function ShareModal({ open, onClose, payload, title = 'Share to…' }: ShareModalProps) {
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

  const dmItems = useMemo(() => {
    return dms.map(conv => {
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
    channels.filter(c => c.name.toLowerCase().includes(query.toLowerCase())),
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
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border/50">
          <DialogTitle className="text-[14px] font-semibold">{title}</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-border/40">
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search friends or channels…"
              className="flex-1 bg-transparent text-[12px] focus:outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-[320px] overflow-y-auto">
          {/* DMs */}
          {dmItems.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Direct Messages</p>
              {dmItems.map(item => {
                const isSel = selected?.type === 'dm' && selected.id === item.convId
                return (
                  <button
                    key={item.convId}
                    onClick={() => selectDM(item)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-accent/60',
                      isSel && 'bg-primary/10'
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={item.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[11px] font-bold">{item.name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-[13px] font-medium">{item.name}</span>
                    {isSel && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}

          {/* Channels */}
          {filteredChannels.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Channels</p>
              {filteredChannels.map(channel => (
                <div key={channel.id}>
                  {/* Channel row */}
                  <button
                    onClick={() => handleExpandChannel(channel.id)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-accent/60"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={channel.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">{channel.name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-[13px] font-medium">{channel.name}</span>
                    <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform', expandedChannel === channel.id && 'rotate-90')} />
                  </button>

                  {/* Text groups inside channel */}
                  {expandedChannel === channel.id && (
                    <div className="bg-muted/30 py-1">
                      {loadingChannel === channel.id ? (
                        <p className="px-8 py-2 text-[11px] text-muted-foreground">Loading…</p>
                      ) : (channelGroups[channel.id] ?? []).length === 0 ? (
                        <p className="px-8 py-2 text-[11px] text-muted-foreground">No message groups</p>
                      ) : (
                        (channelGroups[channel.id] ?? []).map(group => {
                          const isSel = selected?.type === 'group' && selected.id === group.id
                          return (
                            <button
                              key={group.id}
                              onClick={() => selectGroup(group, channel.name)}
                              className={cn(
                                'flex w-full items-center gap-2 px-8 py-1.5 text-left transition-colors hover:bg-accent/60',
                                isSel && 'bg-primary/10'
                              )}
                            >
                              <span className="text-[12px] text-muted-foreground">{group.group_type === 'board' ? 'Forum' : '#'}</span>
                              <span className="flex-1 truncate text-[12px]">{group.name}</span>
                              {isSel && <Check className="h-3 w-3 text-primary shrink-0" />}
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
            <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">No results</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border/50 px-4 py-3">
          <div className="min-w-0 flex-1">
            {selected ? (
              <p className="truncate text-[12px] text-muted-foreground">
                To: <span className="font-semibold text-foreground">{selected.channelName ? `${selected.channelName} › ${selected.label}` : selected.label}</span>
              </p>
            ) : (
              <p className="text-[12px] text-muted-foreground">Select a destination</p>
            )}
          </div>
          <button
            disabled={!selected || sending}
            onClick={handleSend}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-3 w-3" />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
