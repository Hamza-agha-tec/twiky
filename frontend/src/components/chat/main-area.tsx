'use client'

import { cloneElement, isValidElement, useState } from 'react'
import {
  Hash,
  ListTodo,
  NotebookPen,
  Search,
  Target,
  Tv,
  Volume2,
} from 'lucide-react'

import { GoalsPanel } from '@/components/chat/goals-panel'
import type { MockChannelGroup, WorkspaceChannel } from '@/components/chat/channels-panel'
import { FeedProfileSidebarDock } from '@/components/chat/feed-profile-sidebar-dock'
import { NotesPanel } from '@/components/chat/notes-panel'
import { TasksPanel } from '@/components/chat/tasks-panel'
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

export function MainArea({
  activeChannel,
  activeGroup,
  children,
  onTabChange,
  activeTab,
}: MainAreaProps) {
  const [feedProfilePanelWidth, setFeedProfilePanelWidth] = useState(0)
  const [closeFeedProfile, setCloseFeedProfile] = useState<(() => void) | null>(null)
  const [feedProfileSidebarContent, setFeedProfileSidebarContent] = useState<React.ReactNode | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const GroupIcon = activeGroup.kind === 'voice' ? Volume2 : activeGroup.kind === 'watch' ? Tv : Hash
  const groupScopeLabel = activeGroup.kind === 'watch' ? `📺 ${activeGroup.label}` : activeGroup.label
  const feedChild = isValidElement(children)
    ? cloneElement(children as any, {
      onProfilePanelWidthChange: setFeedProfilePanelWidth,
      onProfileSidebarContentChange: setFeedProfileSidebarContent,
      onProfileCloseRequestChange: (closeFn: (() => void) | null) => {
        setCloseFeedProfile(() => closeFn)
      },
    })
    : children

  const channelMonogram = activeChannel.label.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'CH'

  const header = (
    <div className="flex h-[52px] flex-shrink-0 items-center border-b border-border bg-sidebar px-4">
      {/* Left: group icon + name */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <GroupIcon className="h-3.5 w-3.5" />
        </div>
        <p className="text-[13px] font-semibold text-foreground">{groupScopeLabel}</p>
      </div>

      {/* Center: channel avatar + name */}
      <div className="flex flex-1 items-center justify-center gap-1.5">
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-[8px] font-bold text-primary">
          {activeChannel.avatarUrl
            ? <img src={activeChannel.avatarUrl} alt={activeChannel.label} className="h-full w-full object-cover" />
            : channelMonogram
          }
        </div>
        <p className="text-[11px] font-semibold text-foreground">{activeChannel.label}</p>
      </div>

      {/* Right: search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search…"
          className={cn(
            'h-7 w-40 rounded-lg border border-border bg-accent/50 pl-7 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary',
          )}
        />
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

    </div>
  )
}
