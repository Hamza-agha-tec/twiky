'use client';

import { useParams } from 'next/navigation';
import { ProjectNotesView } from '@/components/workspace/project-notes-view';

export default function ProjectNotesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <ProjectNotesView projectId={projectId} />;
}
