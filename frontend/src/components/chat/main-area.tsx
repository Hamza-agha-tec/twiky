'use client'

import { cloneElement, isValidElement, useState } from 'react'
import {
  Hash,
  ListTodo,
  NotebookPen,
  Target,
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

    </div>
  )
}
