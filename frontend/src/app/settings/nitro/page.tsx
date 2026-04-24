'use client'

import { NitroSection } from '@/components/settings/sections/nitro-section'
import { useProfile } from '@/hooks/use-user'
import { isProPlan } from '@/components/chat/verified-badge'

export default function NitroPage() {
  const { data: profile } = useProfile()
  const isPro = isProPlan(profile?.sub_plan)
  return <NitroSection isPro={isPro} />
}
