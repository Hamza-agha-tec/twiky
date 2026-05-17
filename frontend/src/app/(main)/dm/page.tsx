'use client'

import { WorkspaceEmptyState } from '@/components/chat/workspace-empty-state'

export default function DirectMessagesHome() {
  return (
    <div className="flex h-full w-full bg-background">
      <WorkspaceEmptyState
        title="Direct Messages"
        subtitle="Select a conversation from the sidebar or start a new one to begin chatting."
        showShortcuts={false}
      />
    </div>
  )
}
