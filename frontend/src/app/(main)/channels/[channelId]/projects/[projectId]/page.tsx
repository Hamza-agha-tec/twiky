import { redirect } from 'next/navigation';

export default async function ProjectIndexPage({
  params,
}: {
  params: Promise<{ channelId: string; projectId: string }>;
}) {
  const { channelId, projectId } = await params;
  redirect(`/channels/${channelId}/projects/${projectId}/notes`);
}
