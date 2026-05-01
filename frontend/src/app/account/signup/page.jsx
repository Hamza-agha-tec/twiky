'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { SignupForm } from '@/components/signup-form'

const cards = [
  { w: 240, h: 140, top: '6%',  right: '10%', rotate:  5, delay: '0s',    duration: '8s',  accent: '#92dce5' },
  { w: 170, h: 210, top: '25%', left: '7%',   rotate: -7, delay: '1s',    duration: '9.5s',accent: '#0080c8' },
  { w: 210, h: 120, top: '55%', right: '12%', rotate:  3, delay: '0.5s',  duration: '7s',  accent: null },
  { w: 120, h: 85,  top: '40%', left: '50%',  rotate: -8, delay: '2.2s',  duration: '6.5s',accent: '#0080c8' },
  { w: 190, h: 110, top: '74%', left: '10%',  rotate:  6, delay: '0.8s',  duration: '10s', accent: '#92dce5' },
  { w: 95,  h: 95,  top: '16%', left: '42%',  rotate: -4, delay: '1.5s',  duration: '7.5s',accent: null },
]

export default function SignUpPage() {
  useEffect(() => { document.title = 'Sign Up — twiky' }, [])

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
        {/* Brand side */}
        <div
          className="relative hidden overflow-hidden lg:block"
          style={{ background: 'linear-gradient(135deg, #020c14 0%, #041e30 50%, #020c14 100%)' }}
        >
          {/* Blobs */}
          <div className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-25 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #92dce5 0%, transparent 65%)', top: '-10%', left: '-10%' }} />
          <div className="absolute w-[400px] h-[400px] rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #0080c8 0%, transparent 65%)', bottom: '-5%', right: '-5%' }} />
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
              <SignupForm />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
