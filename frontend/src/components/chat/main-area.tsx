'use client'

import { cloneElement, isValidElement, useEffect, useState } from 'react'
import {
  Archive,
  Hash,
  ListTodo,
  MoreHorizontal,
  NotebookPen,
  Target,
  Trash2,
  Volume2,
} from 'lucide-react'

import { GoalsPanel } from '@/components/chat/goals-panel'
import type { MockChannelGroup, WorkspaceChannel } from '@/components/chat/channels-panel'
import { FeedProfileSidebarDock } from '@/components/chat/feed-profile-sidebar-dock'
import { NotesPanel } from '@/components/chat/notes-panel'
import { TasksPanel } from '@/components/chat/tasks-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export type MainAreaTab = 'feed' | 'notes' | 'tasks' | 'goals'

interface MainAreaProps {
  activeChannel: WorkspaceChannel
  activeGroup: MockChannelGroup
  children: React.ReactNode
  onTabChange?: (tab: MainAreaTab) => void
  activeTab: MainAreaTab
}

const CHANNEL_TABS = [
  { id: 'feed' as const,  label: 'Feed',  icon: Hash },
  { id: 'notes' as const, label: 'Notes', icon: NotebookPen },
  { id: 'tasks' as const, label: 'Tasks', icon: ListTodo },
  { id: 'goals' as const, label: 'Goals', icon: Target },
]

function GroupSettingsSheet({
  group,
  open,
  onOpenChange,
}: {
  group: MockChannelGroup
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState(group.label)
  const [description, setDescription] = useState(group.description)
  const [kind, setKind] = useState<'text' | 'voice'>(group.kind)
  const [notifications, setNotifications] = useState(true)
  const [mentionsOnly, setMentionsOnly] = useState(false)
  const [slowMode, setSlowMode] = useState(false)
  const [readOnly, setReadOnly] = useState(false)

  useEffect(() => {
    setName(group.label)
    setDescription(group.description)
    setKind(group.kind)
    setNotifications(true)
    setMentionsOnly(false)
    setSlowMode(false)
    setReadOnly(false)
  }, [group.description, group.id, group.kind, group.label])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] overflow-y-auto p-0 sm:max-w-[360px]">
        <SheetHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              {group.kind === 'voice' ? (
                <Volume2 className="h-4 w-4 text-primary" />
              ) : (
                <Hash className="h-4 w-4 text-primary" />
              )}
            </div>
            <SheetTitle className="text-[13px]">
              {group.kind === 'voice' ? group.label : `#${group.label}`} — Group Settings
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="divide-y divide-border">
          <div className="space-y-3 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">General</p>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Group name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 rounded-xl text-[12px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[64px] rounded-xl text-[12px] leading-5" />
            </div>
          </div>

          <div className="space-y-3 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Channel type</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'text' as const, Icon: Hash, label: 'Text', desc: 'Messages and threads' },
                { value: 'voice' as const, Icon: Volume2, label: 'Voice', desc: 'Audio conversations' },
              ]).map(({ value, Icon, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setKind(value)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-colors',
                    kind === value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                  )}
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-semibold text-foreground">{label}</span>
                  <span className="text-[10px] leading-4 text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Notifications</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-foreground">All messages</p>
                <p className="text-[11px] text-muted-foreground">Notify for every new message</p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-foreground">Mentions only</p>
                <p className="text-[11px] text-muted-foreground">Only notify when @mentioned</p>
              </div>
              <Switch checked={mentionsOnly} onCheckedChange={setMentionsOnly} />
            </div>
          </div>

          <div className="space-y-3 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Moderation</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-foreground">Slow mode</p>
                <p className="text-[11px] text-muted-foreground">Limit how often members can post</p>
              </div>
              <Switch checked={slowMode} onCheckedChange={setSlowMode} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-foreground">Read-only</p>
                <p className="text-[11px] text-muted-foreground">Only admins can post</p>
              </div>
              <Switch checked={readOnly} onCheckedChange={setReadOnly} />
            </div>
          </div>

          <div className="space-y-3 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Info</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-border bg-background/80 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground">Members</p>
                <p className="mt-1 text-[14px] font-semibold text-foreground">{group.membersLabel}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/80 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground">Type</p>
                <p className="mt-1 text-[14px] font-semibold capitalize text-foreground">{group.kind}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-destructive">Danger zone</p>
            <div className="space-y-2">
              <button className="flex w-full items-center gap-2.5 rounded-2xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-accent">
                <Archive className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[12px] font-medium text-foreground">Archive group</p>
                  <p className="text-[11px] text-muted-foreground">Read-only, stays in channel</p>
                </div>
              </button>
              <button className="flex w-full items-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-left transition-colors hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-[12px] font-medium text-destructive">Delete group</p>
                  <p className="text-[11px] text-muted-foreground">Remove group and all messages</p>
                </div>
              </button>
            </div>
          </div>

          <div className="p-4">
            <Button className="w-full rounded-xl text-[12px]" onClick={() => onOpenChange(false)}>
              Save changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function MainArea({
  activeChannel,
  activeGroup,
  children,
  onTabChange,
  activeTab,
}: MainAreaProps) {
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false)
  const [feedProfilePanelWidth, setFeedProfilePanelWidth] = useState(0)
  const [closeFeedProfile, setCloseFeedProfile] = useState<(() => void) | null>(null)
  const [feedProfileSidebarContent, setFeedProfileSidebarContent] = useState<React.ReactNode | null>(null)

  const GroupIcon = activeGroup.kind === 'voice' ? Volume2 : Hash
  const groupScopeLabel = activeGroup.kind === 'voice' ? activeGroup.label : `#${activeGroup.label}`
  const feedChild = isValidElement(children)
    ? cloneElement(children as any, {
      onProfilePanelWidthChange: setFeedProfilePanelWidth,
      onProfileSidebarContentChange: setFeedProfileSidebarContent,
      onProfileCloseRequestChange: (closeFn: (() => void) | null) => {
        setCloseFeedProfile(() => closeFn)
      },
    })
    : children

  const header = (
    <div className="flex-shrink-0 border-b border-border bg-sidebar">
      <div className="flex h-[52px] items-center gap-3 px-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <GroupIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-foreground">{groupScopeLabel}</p>
            <span className="hidden text-[12px] text-muted-foreground sm:block">
              — {activeGroup.membersLabel}
            </span>
          </div>
          <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
            {activeChannel.label} · {activeChannel.groups.length} groups
          </p>
        </div>
        <button
          onClick={() => setGroupSettingsOpen(true)}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-0 border-t border-border/40 px-2">
        {CHANNEL_TABS.filter(tab => activeChannel.type === 'WORKSPACE' || tab.id === 'feed').map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => onTabChange?.(id)}
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12px] font-semibold transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground/80',
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-primary' : '')} />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden bg-background">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {header}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {activeTab === 'feed' ? feedChild : null}
          {activeTab === 'notes' ? (
            <NotesPanel scopeKey={activeGroup.id} scopeLabel={groupScopeLabel} scopeType="group" />
          ) : null}
          {activeTab === 'tasks' ? (
            <TasksPanel scopeKey={activeGroup.id} scopeLabel={groupScopeLabel} scopeType="group" />
          ) : null}
          {activeTab === 'goals' ? (
            <GoalsPanel scopeKey={activeGroup.id} scopeLabel={groupScopeLabel} scopeType="group" />
          ) : null}
        </div>
      </div>

      {activeTab === 'feed' ? (
        <FeedProfileSidebarDock
          open={feedProfilePanelWidth > 0}
          width={feedProfilePanelWidth}
          onBack={() => closeFeedProfile?.()}
        >
          {feedProfileSidebarContent}
        </FeedProfileSidebarDock>
      ) : null}

      <GroupSettingsSheet
        key={activeGroup.id}
        group={activeGroup}
        open={groupSettingsOpen}
        onOpenChange={setGroupSettingsOpen}
      />
    </div>
  )
}
