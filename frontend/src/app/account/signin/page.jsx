'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { LoginForm } from '@/components/login-form'

const cards = [
  { w: 260, h: 150, top: '8%',  left: '8%',  rotate: -4, delay: '0s',    duration: '7s',  accent: '#0080c8' },
  { w: 180, h: 220, top: '28%', right: '6%', rotate:  6, delay: '1.2s',  duration: '9s',  accent: '#92dce5' },
  { w: 220, h: 130, top: '52%', left: '18%', rotate: -2, delay: '0.6s',  duration: '8s',  accent: null },
  { w: 130, h: 90,  top: '44%', left: '52%', rotate:  9, delay: '2s',    duration: '6s',  accent: '#0080c8' },
  { w: 200, h: 115, top: '72%', right: '9%', rotate: -6, delay: '0.3s',  duration: '10s', accent: '#92dce5' },
  { w: 100, h: 100, top: '14%', left: '55%', rotate:  5, delay: '1.8s',  duration: '7.5s',accent: null },
]

export default function SignInPage() {
  useEffect(() => { document.title = 'Sign In — twiky' }, [])

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: var(--r) translateY(0px); }
          50%       { transform: var(--r) translateY(-10px); }
        }
        .deck-card { animation: float var(--dur) ease-in-out var(--delay) infinite; }
      `}</style>

      <div className="grid min-h-svh lg:grid-cols-2">
        {/* Form side */}
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex justify-center gap-2 md:justify-start">
            <Link href="/" className="flex items-center gap-2 font-medium">
              <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Zap className="size-4" />
              </div>
              twiky
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xs">
              <LoginForm />
            </div>
          </div>
        </div>

        {/* Brand side */}
        <div
          className="relative hidden overflow-hidden lg:block"
          style={{ background: 'linear-gradient(135deg, #020c14 0%, #041e30 50%, #020c14 100%)' }}
        >
          {/* Blobs */}
          <div className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-30 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #0080c8 0%, transparent 65%)', top: '-10%', right: '-10%' }} />
          <div className="absolute w-[400px] h-[400px] rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #92dce5 0%, transparent 65%)', bottom: '-5%', left: '-5%' }} />
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

          {/* Floating cards */}
          {cards.map((c, i) => (
            <div
              key={i}
              className="deck-card absolute rounded-2xl overflow-hidden"
              style={{
                width: c.w,
                height: c.h,
                top: c.top,
                left: c.left,
                right: c.right,
                '--r': `rotate(${c.rotate}deg)`,
                '--dur': c.duration,
                '--delay': c.delay,
                transform: `rotate(${c.rotate}deg)`,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
            >
              {c.accent && (
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${c.accent}, transparent)` }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
