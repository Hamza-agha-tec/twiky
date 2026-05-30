'use client';

import { useParams } from 'next/navigation';
import { ProjectTasksView } from '@/components/workspace/project-tasks-view';

export default function ProjectTasksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <ProjectTasksView projectId={projectId} />;
}
