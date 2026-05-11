'use client'

import React, { useState, useEffect, useRef } from 'react'
import { GiphyFetch } from '@giphy/js-fetch-api'
import type { IGif } from '@giphy/js-types'
import EmojiPicker, { Theme, EmojiClickData, EmojiStyle } from 'emoji-picker-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { SmilePlus, Gift, Sticker } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from 'next-themes'

const API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? ''
const gf = API_KEY && API_KEY !== 'YOUR_GIPHY_API_KEY' ? new GiphyFetch(API_KEY) : null

function useGifs(query: string, type: 'gifs' | 'stickers') {
  const [gifs, setGifs] = useState<IGif[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gf) { setError('no_key'); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    const req = query
      ? gf.search(query, { limit: 18, type })
      : gf.trending({ limit: 18, type })

    req.then(({ data }) => {
      if (!cancelled) { setGifs(data); setLoading(false) }
    }).catch(() => {
      if (!cancelled) { setError('fetch_error'); setLoading(false) }
    })

    return () => { cancelled = true }
  }, [query, type])

  return { gifs, loading, error }
}

function GifGrid({ type, onSelect }: { type: 'gifs' | 'stickers'; onSelect: (url: string) => void }) {
  const [inputVal, setInputVal] = useState('')
  const [query, setQuery] = useState('')
  const { gifs, loading, error } = useGifs(query, type)

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder={`Search ${type}…`}
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') setQuery(inputVal) }}
        className="h-8 text-[12px]"
      />
      <div className="overflow-y-auto flex items-start justify-center" style={{ height: 260 }}>
        {error === 'no_key' ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <p className="text-xs font-medium">Giphy API key missing</p>
            <p className="text-[11px] text-muted-foreground">
              Set <code className="bg-muted px-1 rounded text-[10px]">NEXT_PUBLIC_GIPHY_API_KEY</code> in{' '}
              <code className="bg-muted px-1 rounded text-[10px]">.env.local</code>
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center w-full h-full text-muted-foreground text-xs">Loading…</div>
        ) : error ? (
          <div className="flex items-center justify-center w-full h-full text-muted-foreground text-xs">Failed to load</div>
        ) : gifs.length === 0 ? (
          <div className="flex items-center justify-center w-full h-full text-muted-foreground text-xs">No results</div>
        ) : (
          <div className="grid grid-cols-3 gap-1 w-full">
            {gifs.map(gif => {
              const src = gif.images.fixed_height_small?.url ?? gif.images.fixed_height?.url ?? ''
              return (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => onSelect(gif.images.fixed_height.url)}
                  className="overflow-hidden rounded-md aspect-square hover:opacity-80 transition-opacity bg-accent"
                >
                  <img src={src} alt={gif.title} className="w-full h-full object-cover" loading="lazy" />
                </button>
              )
            })}
          </div>
        )}
      </div>
      <p className="text-[9px] text-muted-foreground text-right">Powered by GIPHY</p>
    </div>
  )
}

export function EmojiButton({ onEmojiSelect, disabled }: { onEmojiSelect: (e: string) => void; disabled?: boolean }) {
  const { resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Emoji"
        onClick={() => setOpen(v => !v)}
      >
        <SmilePlus className="h-[15px] w-[15px]" />
      </Button>

      {open && (
        <div className="absolute bottom-10 right-0 z-50 rounded-2xl overflow-hidden border border-border bg-sidebar" style={{ boxShadow: '0 8px 40px 0 rgba(0,0,0,0.45), 0 2px 8px 0 rgba(0,0,0,0.25)' }}>
          <EmojiPicker
            onEmojiClick={(emojiData: EmojiClickData) => onEmojiSelect(emojiData.unified)}
            theme={isDark ? Theme.DARK : Theme.LIGHT}
            emojiStyle={EmojiStyle.APPLE}
            skinTonesDisabled
            searchDisabled={false}
            previewConfig={{ showPreview: false }}
            style={{
              '--epr-bg-color': isDark ? 'var(--sidebar)' : 'var(--background)',
              '--epr-category-label-bg-color': isDark ? 'var(--sidebar)' : 'var(--muted)',
              '--epr-search-input-bg-color': isDark ? 'oklch(0.18 0.02 260)' : 'var(--muted)',
              '--epr-hover-bg-color': isDark ? 'oklch(0.22 0.02 260)' : 'var(--accent)',
              '--epr-focus-bg-color': isDark ? 'oklch(0.22 0.02 260)' : 'var(--accent)',
              '--epr-text-color': 'var(--foreground)',
              '--epr-search-border-color': 'var(--border)',
              '--epr-border-color': 'var(--border)',
              '--epr-highlight-color': 'var(--primary)',
              background: 'transparent',
              border: 'none',
              borderRadius: '0',
            } as React.CSSProperties}
          />
        </div>
      )}
    </div>
  )
}

export function GifButton({ onGifSelect, disabled }: { onGifSelect: (url: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
          title="GIF"
        >
          <span className="text-[10px] font-bold tracking-tight">GIF</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-[300px] p-3 bg-sidebar border-border" style={{ boxShadow: '0 8px 40px 0 rgba(0,0,0,0.45), 0 2px 8px 0 rgba(0,0,0,0.25)' }}>
        <GifGrid type="gifs" onSelect={(url) => { onGifSelect(url); setOpen(false) }} />
      </PopoverContent>
    </Popover>
  )
}

export function StickerButton({ onStickerSelect, disabled }: { onStickerSelect: (url: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Sticker"
        >
          <Sticker className="h-[15px] w-[15px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-[300px] p-3 bg-sidebar border-border" style={{ boxShadow: '0 8px 40px 0 rgba(0,0,0,0.45), 0 2px 8px 0 rgba(0,0,0,0.25)' }}>
        <GifGrid type="stickers" onSelect={(url) => { onStickerSelect(url); setOpen(false) }} />
      </PopoverContent>
    </Popover>
  )
}

export function GiftButton({ disabled }: { disabled?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
      title="Gift"
      onClick={() => {}}
    >
      <Gift className="h-[15px] w-[15px]" />
    </Button>
  )
}
