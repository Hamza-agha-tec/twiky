'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Smartphone, LogOut } from 'lucide-react'
import { SectionHeader, SectionBlock, SettingRow } from '../shared'

export function SecuritySection() {
  const [twoFactor, setTwoFactor] = useState(false)
  const [loginAlerts, setLoginAlerts] = useState(true)
  const [sessionTimeout, setSessionTimeout] = useState('30d')

  return (
    <>
      <SectionHeader title="Security" description="Protect your account and manage sessions." />
      <SectionBlock title="Two-Factor Authentication">
        <div className="flex items-center justify-between py-2.5 px-1">
          <div>
            <p className="text-[13px] font-medium text-foreground">2FA is {twoFactor ? 'active' : 'not enabled'}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{twoFactor ? 'Your account is protected.' : 'Strongly recommended.'}</p>
          </div>
          <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
        </div>
        {!twoFactor ? <div className="py-2"><Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px] gap-1.5"><Smartphone className="h-3.5 w-3.5" />Set up authenticator</Button></div> : null}
      </SectionBlock>
      <SectionBlock title="Sessions">
        <SettingRow title="Login alerts" description="Notify on new device sign-ins."><Switch checked={loginAlerts} onCheckedChange={setLoginAlerts} /></SettingRow>
        <SettingRow title="Session timeout" description="Auto sign-out after inactivity.">
          <Select value={sessionTimeout} onValueChange={setSessionTimeout}><SelectTrigger className="h-8 w-[120px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1d">1 day</SelectItem><SelectItem value="7d">7 days</SelectItem><SelectItem value="30d">30 days</SelectItem><SelectItem value="never">Never</SelectItem></SelectContent></Select>
        </SettingRow>
        <div className="py-2"><Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px] text-destructive border-destructive/30 hover:bg-destructive/10"><LogOut className="mr-1.5 h-3.5 w-3.5" />Sign out all other devices</Button></div>
      </SectionBlock>
    </>
  )
}
