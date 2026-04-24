'use client'

import { Sparkles, Store } from 'lucide-react'

const STORE_ITEMS = [
  { id: 'themes', label: 'Themes', description: 'Custom color schemes and visual styles', count: 24, tag: 'Popular', gradient: 'from-violet-500 via-purple-500 to-fuchsia-600' },
  { id: 'stickers', label: 'Sticker Packs', description: 'Expressive sticker sets for reactions', count: 48, tag: 'New', gradient: 'from-orange-500 via-amber-500 to-yellow-500' },
  { id: 'sounds', label: 'Sound Packs', description: 'Custom notification and UI sounds', count: 12, tag: null, gradient: 'from-emerald-500 via-teal-500 to-cyan-600' },
  { id: 'frames', label: 'Profile Frames', description: 'Animated borders for your avatar', count: 36, tag: 'Hot', gradient: 'from-pink-500 via-rose-500 to-red-500' },
  { id: 'rooms', label: 'Room Templates', description: 'Backgrounds and layouts for your profile room', count: 18, tag: 'Coming soon', gradient: 'from-cyan-500 via-sky-500 to-blue-600' },
  { id: 'badges', label: 'Badges', description: 'Collectible profile badges to show off', count: 60, tag: 'Exclusive', gradient: 'from-amber-500 via-orange-500 to-rose-500' },
] as const

export function StoreView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/10 via-background to-background px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 text-primary">
            <Store className="h-5 w-5" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Twiky Store</span>
          </div>
          <h1 className="mt-2 text-[28px] font-black tracking-tight text-foreground">Personalize your workspace</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">Themes, stickers, frames, and more — make Twiky yours.</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-8 py-8">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Browse categories</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {STORE_ITEMS.map((item) => (
            <button
              key={item.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card text-left transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className={`h-20 bg-gradient-to-br ${item.gradient} opacity-80`} />
              <div className="p-3">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-[13px] font-bold text-foreground">{item.label}</p>
                  {item.tag ? (
                    <span className="flex-shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                      {item.tag}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.description}</p>
                <p className="mt-2 text-[10px] font-semibold text-muted-foreground">{item.count} items</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-[15px] font-bold text-foreground">Twiky Premium unlocks everything</p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Get all themes, sticker packs, and exclusive frames — free forever for early members.</p>
          <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            <Sparkles className="h-4 w-4" />
            Learn about Premium
          </button>
        </div>
      </div>
    </div>
  )
}
