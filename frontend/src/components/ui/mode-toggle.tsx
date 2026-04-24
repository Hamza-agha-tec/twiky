'use client'

import { useRef } from 'react'
import { flushSync } from 'react-dom'
import { Moon, Sun } from 'lucide-react'

import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ModeToggleProps {
  buttonClassName?: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
}

export function ModeToggle({ buttonClassName, variant = 'outline' }: ModeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const btnRef = useRef<HTMLButtonElement>(null)

  const toggle = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark'

    const btn = btnRef.current
    if (btn) {
      const rect = btn.getBoundingClientRect()
      document.documentElement.style.setProperty('--theme-ripple-x', `${rect.left + rect.width / 2}px`)
      document.documentElement.style.setProperty('--theme-ripple-y', `${rect.top + rect.height / 2}px`)
    }

    if (!('startViewTransition' in document)) {
      setTheme(next)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(document as any).startViewTransition(() => {
      flushSync(() => setTheme(next))
    })
  }

  return (
    <Button
      ref={btnRef}
      variant={variant}
      size="icon"
      onClick={toggle}
      className={cn('relative', buttonClassName)}
      aria-label="Toggle theme"
    >
      <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
