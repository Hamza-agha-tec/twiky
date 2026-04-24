'use client'

import { CalendarDays, Download, Shield, Archive, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionHeader, SectionBlock, SettingRow, formatDate, formatRelativeDate } from '../shared'
import type { UserProfile } from '@/lib/user-api'

export function AccountSection({ profile }: { profile?: UserProfile }) {
  return (
    <>
      <SectionHeader title="My Account" description="Manage your credentials and linked accounts." />
      <SectionBlock title="Account Info">
        <SettingRow title="Username" description={profile?.username ? `@${profile.username}` : 'Not set'}>
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px]">Edit</Button>
        </SettingRow>
        <SettingRow title="User ID" description={profile?.id ?? 'Loading profile...'}>
          <Badge variant="outline" className="rounded-full text-[10px]">Backend</Badge>
        </SettingRow>
        <SettingRow title="Phone number" description={profile?.phone_number ?? 'Not set'}>
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px]">
            {profile?.phone_number ? 'Edit' : 'Add'}
          </Button>
        </SettingRow>
        <SettingRow title="Member since" description={formatDate(profile?.created_at)}>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </SettingRow>
        <SettingRow title="Last seen" description={formatRelativeDate(profile?.last_seen_at)}>
          <Badge variant="secondary" className="rounded-full text-[10px]">
            {profile?.status ?? 'Offline'}
          </Badge>
        </SettingRow>
      </SectionBlock>
      <SectionBlock title="Password & Authentication">
        <SettingRow title="Password" description="Last changed 3 months ago">
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px]">Change</Button>
        </SettingRow>
        <SettingRow title="Two-factor auth" description="Add an extra layer of security.">
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px] gap-1.5">
            <Shield className="h-3.5 w-3.5" />Enable 2FA
          </Button>
        </SettingRow>
        <SettingRow title="Backup codes" description="Emergency one-time access codes.">
          <Button variant="ghost" size="sm" className="h-8 rounded-xl text-[11px]">View</Button>
        </SettingRow>
      </SectionBlock>
      <SectionBlock title="Account Actions">
        <SettingRow title="Download my data" description="Request a copy of all your data.">
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px] gap-1.5">
            <Download className="h-3.5 w-3.5" />Request
          </Button>
        </SettingRow>
        <div className="py-3">
          <p className="text-[13px] font-semibold text-foreground">Danger Zone</p>
          <p className="mt-1 text-[12px] text-muted-foreground">These actions are permanent and cannot be undone.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-xl border-amber-500/30 text-[11px] text-orange-600 hover:bg-orange-500/10">
              <Archive className="mr-1.5 h-3.5 w-3.5" />Deactivate
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-xl border-destructive/30 text-[11px] text-destructive hover:bg-destructive/10">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete Account
            </Button>
          </div>
        </div>
      </SectionBlock>
    </>
  )
}
