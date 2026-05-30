'use client';

import { useParams } from 'next/navigation';
import { ProjectGoalsView } from '@/components/workspace/project-goals-view';

export default function ProjectGoalsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <ProjectGoalsView projectId={projectId} />;
}
