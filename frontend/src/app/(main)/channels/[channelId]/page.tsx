'use client'

import { WorkspaceEmptyState } from '@/components/chat/workspace-empty-state'

export default function ChannelPage() {
  return (
    <WorkspaceEmptyState 
      title="No group selected" 
      subtitle="Select a group from the sidebar to start chatting." 
    />
  )
}
