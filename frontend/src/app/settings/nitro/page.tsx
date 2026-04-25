'use client'

import { NitroSection } from '@/components/settings/sections/nitro-section'
import { useProfile } from '@/hooks/use-user'

export default function NitroPage() {
  const { data: profile } = useProfile()
  return <NitroSection subPlan={profile?.sub_plan ?? null} />
}
