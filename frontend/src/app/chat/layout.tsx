'use client'

import { WorkspaceShellLayout } from '@/components/chat/workspace-shell-layout'

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <WorkspaceShellLayout>{children}</WorkspaceShellLayout>
}
