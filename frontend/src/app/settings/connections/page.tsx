'use client'

import { ConnectionsSection } from '@/components/settings/sections/connections-section'
import { useProfile } from '@/hooks/use-user'

export default function ConnectionsPage() {
  const { data: profile } = useProfile()
  return <ConnectionsSection profile={profile} />
}
