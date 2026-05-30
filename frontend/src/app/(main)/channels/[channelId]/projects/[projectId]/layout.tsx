'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProjectSidebar } from '@/components/workspace/project-sidebar';
import { useChannels } from '@/hooks/use-channels';
import { useChannelProjects } from '@/hooks/use-projects';
import { WorkspaceEmptyState } from '@/components/chat/workspace-empty-state';
import { isWorkspaceChannel } from '@/lib/channel-utils';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { channelId, projectId } = useParams<{ channelId: string; projectId: string }>();
  const router = useRouter();
  const { data: channels = [], isLoading } = useChannels();
  const channel = channels.find((c) => c.id === channelId);
  const { data: projects = [] } = useChannelProjects(channelId);

  useEffect(() => {
    if (!channel || !isWorkspaceChannel(channel.type)) return;
    if (!projectId && projects.length > 0) {
      router.replace(`/channels/${channelId}/projects/${projects[0].id}/notes`);
    }
  }, [channel, channelId, projectId, projects, router]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!channel || !isWorkspaceChannel(channel.type)) {
    return (
      <WorkspaceEmptyState
        title="Not a workspace channel"
        subtitle="This channel uses the classic group layout. Open a workspace channel to use projects."
        showShortcuts={false}
      />
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <ProjectSidebar />
      <div className="min-w-0 flex-1 flex flex-col bg-background">{children}</div>
    </div>
  );
}
