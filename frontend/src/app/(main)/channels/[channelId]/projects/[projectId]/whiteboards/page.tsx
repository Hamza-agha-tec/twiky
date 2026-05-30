'use client';

import { useParams } from 'next/navigation';
import { ProjectWhiteboardsView } from '@/components/workspace/project-whiteboards-view';

export default function ProjectWhiteboardsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <ProjectWhiteboardsView projectId={projectId} />;
}
