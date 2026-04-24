'use client'

import { useProfile } from '@/hooks/use-user'
import { useAuth } from '@/context/AuthContext'
import { isVerifiedAccountIdentity, isProPlan } from '@/components/chat/verified-badge'
import { WorkspaceShellLayout } from '@/components/chat/workspace-shell-layout'
import { SettingsSidebar } from '@/components/settings/settings-sidebar'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const pathname = usePathname()

  const isVerified = isVerifiedAccountIdentity({
    email: profile?.email ?? user?.email,
    id: profile?.id,
    is_verified: profile?.is_verified,
    sub_plan: profile?.sub_plan,
  })
  const isPro = isProPlan(profile?.sub_plan)

  return (
    <WorkspaceShellLayout>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <SettingsSidebar
          profile={profile}
          isVerified={isVerified}
          isPro={isPro}
          avatarUrl={profile?.avatar_url}
        />
        <div className="relative flex-1 overflow-y-auto bg-background px-8 py-7">
          <div className="mx-auto max-w-[640px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </WorkspaceShellLayout>
  )
}
