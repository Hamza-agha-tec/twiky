'use client'

import { useQuery } from '@tanstack/react-query'

interface PreviewData {
  url: string
  title?: string | null
  description?: string | null
  image_url?: string | null
  site_name?: string | null
  favicon?: string | null
}

function safeHostname(url: string) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

// ── Platform helpers ──────────────────────────────────────────────────────────

function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/watch\?(?:[^&]*&)*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  )
  return m?.[1] ?? null
}

function isInstagram(url: string) {
  return /instagram\.com\/(p|reel|tv)\//.test(url)
}

function isTikTok(url: string) {
  return /tiktok\.com\/@.+\/video\//.test(url)
}

// ── Platform cards ────────────────────────────────────────────────────────────

function YouTubeEmbed({ videoId, preview }: { videoId: string; preview: PreviewData }) {
  return (
    <div className="mt-2 max-w-lg overflow-hidden rounded-xl border border-border shadow-md">
      <div className="relative aspect-video w-full bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
          title={preview.title ?? 'YouTube video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
      {preview.title && (
        <div className="bg-sidebar/55 px-3.5 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="#FF0000">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8zM9.75 15.5V8.5l6.25 3.5-6.25 3.5z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">YouTube</span>
          </div>
          <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">{preview.title}</p>
        </div>
      )}
    </div>
  )
}

function PlatformCard({
  preview,
  logo,
  color,
}: {
  preview: PreviewData
  logo: React.ReactNode
  color: string
}) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-sidebar/55 hover:bg-sidebar/85 transition-all shadow-md group/embed"
    >
      {preview.image_url && (
        <div className="relative aspect-video w-full border-b border-border/40 overflow-hidden bg-black/10">
          <img
            src={preview.image_url}
            alt={preview.title ?? 'Preview'}
            className="h-full w-full object-cover transition-transform duration-300 group-hover/embed:scale-[1.02]"
          />
        </div>
      )}
      <div className="p-3.5 space-y-1.5">
        <div className="flex items-center gap-2">
          {logo}
          <span className={`text-[10px] font-bold uppercase tracking-widest ${color}`}>
            {preview.site_name ?? safeHostname(preview.url)}
          </span>
        </div>
        {preview.title && (
          <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2 group-hover/embed:text-primary transition-colors">
            {preview.title}
          </p>
        )}
        {preview.description && (
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{preview.description}</p>
        )}
      </div>
    </a>
  )
}

function TikTokCard({ preview }: { preview: PreviewData }) {
  return (
    <PlatformCard
      preview={preview}
      color="text-[#69C9D0]"
      logo={
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#69C9D0' }}>
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
        </svg>
      }
    />
  )
}

function InstagramCard({ preview }: { preview: PreviewData }) {
  return (
    <PlatformCard
      preview={preview}
      color="text-[#E1306C]"
      logo={
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="url(#ig-grad)">
          <defs>
            <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f09433" />
              <stop offset="25%" stopColor="#e6683c" />
              <stop offset="50%" stopColor="#dc2743" />
              <stop offset="75%" stopColor="#cc2366" />
              <stop offset="100%" stopColor="#bc1888" />
            </linearGradient>
          </defs>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      }
    />
  )
}

function GenericCard({ preview }: { preview: PreviewData }) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-sidebar/55 hover:bg-sidebar/85 transition-all shadow-md group/embed"
    >
      {preview.image_url && (
        <div className="relative aspect-video w-full border-b border-border/40 overflow-hidden bg-black/10">
          <img
            src={preview.image_url}
            alt={preview.title ?? 'Preview'}
            className="h-full w-full object-cover transition-transform duration-300 group-hover/embed:scale-[1.02]"
          />
        </div>
      )}
      <div className="p-3.5 space-y-2">
        <div className="flex items-center gap-2">
          {preview.favicon && (
            <img src={preview.favicon} alt="" className="h-4 w-4 rounded-sm object-contain" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {preview.site_name ?? safeHostname(preview.url)}
          </span>
        </div>
        {preview.title && (
          <h4 className="text-[13px] font-bold text-foreground leading-snug group-hover/embed:text-primary transition-colors">
            {preview.title}
          </h4>
        )}
        {preview.description && (
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{preview.description}</p>
        )}
      </div>
    </a>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

const URL_RE = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*/g

export function extractFirstUrl(text: string): string | null {
  const matches = text.match(URL_RE)
  return matches?.[0] ?? null
}

export function LinkPreviewCard({ url }: { url: string }) {
  const { data: preview, isLoading } = useQuery<PreviewData>({
    queryKey: ['link-preview', url],
    queryFn: () =>
      fetch(`/api/link-preview?url=${encodeURIComponent(url)}`).then((r) => {
        if (!r.ok) throw new Error('preview failed')
        return r.json()
      }),
    staleTime: 1000 * 60 * 10,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="mt-2 max-w-lg rounded-xl border border-border bg-sidebar/55 overflow-hidden shadow-md animate-pulse">
        <div className="aspect-video w-full bg-muted/40" />
        <div className="p-3.5 space-y-2">
          <div className="h-3 w-24 rounded bg-muted/60" />
          <div className="h-4 w-3/4 rounded bg-muted/40" />
          <div className="h-3 w-full rounded bg-muted/30" />
        </div>
      </div>
    )
  }

  if (!preview || (!preview.title && !preview.image_url)) return null

  const ytId = youtubeId(url)
  if (ytId) return <YouTubeEmbed videoId={ytId} preview={preview} />
  if (isTikTok(url)) return <TikTokCard preview={preview} />
  if (isInstagram(url)) return <InstagramCard preview={preview} />
  return <GenericCard preview={preview} />
}
