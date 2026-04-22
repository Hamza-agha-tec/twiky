'use client'

import { MessageSquareMore, Settings2, Store, UserPlus } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ActiveView = 'chat' | 'settings' | 'store' | 'add-friends'

interface IconRailProps {
  activeView: ActiveView
  onViewChange: (view: ActiveView) => void
  onAvatarClick: () => void
  userInitial?: string
  userAvatar?: string | null
}

const NAV_ITEMS = [
  { id: 'chat',         label: 'Chat',       icon: MessageSquareMore },
  { id: 'add-friends',  label: 'Add Friends', icon: UserPlus },
  { id: 'store',        label: 'Store',      icon: Store },
  { id: 'settings',     label: 'Settings',   icon: Settings2 },
] as const satisfies ReadonlyArray<{ id: ActiveView; label: string; icon: typeof MessageSquareMore }>

export function IconRail({
  activeView,
  onViewChange,
  onAvatarClick,
  userInitial = 'Y',
  userAvatar,
}: IconRailProps) {
  return (
    <TooltipProvider delayDuration={250}>
      <nav className="z-50 hidden w-[68px] flex-shrink-0 flex-col items-center border-r border-border bg-sidebar py-4 md:flex">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-base font-black text-primary-foreground shadow-sm">
          T
        </div>

        <div className="flex flex-1 flex-col items-center gap-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeView === id
            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewChange(id)}
                    className={cn(
                      'relative h-11 w-11 rounded-2xl',
                      isActive
                        ? 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {isActive ? (
                      <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                    ) : null}
                    <Icon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {/* Avatar — opens settings → profile */}
        <div className="flex flex-col items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onAvatarClick}
                className="rounded-full ring-2 ring-transparent transition-all hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="h-10 w-10 border-2 border-border">
                  <AvatarImage src={userAvatar ?? ''} alt={userInitial} />
                  <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">My Profile</TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  )
}
