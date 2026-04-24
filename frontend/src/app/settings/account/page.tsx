'use client'

import { AccountSection } from '@/components/settings/sections/account-section'
import { useProfile } from '@/hooks/use-user'

export default function AccountPage() {
  const { data: profile } = useProfile()
  return <AccountSection profile={profile} />
}
