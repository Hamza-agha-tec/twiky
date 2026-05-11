'use client'

import { useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Download, Share2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ShareModal } from '@/components/chat/share-modal'

interface QRCodeModalProps {
  open: boolean
  onClose: () => void
  username: string
  name: string
  avatarUrl?: string | null
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twiky.app'

export function buildProfilePayload(name: string, username: string, avatarUrl: string | null | undefined) {
  return JSON.stringify({
    __twiky_type: 'profile',
    username,
    name,
    avatarUrl: avatarUrl ?? null,
    url: `${APP_URL}/u/${username}`,
  })
}

export function QRCodeModal({ open, onClose, username, name, avatarUrl }: QRCodeModalProps) {
  const profileUrl = `${APP_URL}/u/${username}`
  const svgRef = useRef<SVGSVGElement>(null)
  const [shareOpen, setShareOpen] = useState(false)

  function handleDownload() {
    const svg = svgRef.current
    if (!svg) return
    const data = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([data], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${username}-qr.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Dialog open={open && !shareOpen} onOpenChange={v => { if (!v) onClose() }}>
        <DialogContent className="max-w-[280px] p-0 gap-0 overflow-hidden rounded-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>QR Code</DialogTitle>
          </DialogHeader>

          {/* QR card — white, self-contained */}
          <div className="flex flex-col items-center bg-white px-7 pt-7 pb-5 gap-3">
            {/* QR with avatar embedded in center */}
            <div className="rounded-2xl overflow-hidden ring-1 ring-black/5">
              <QRCodeSVG
                ref={svgRef}
                value={profileUrl}
                size={192}
                bgColor="#ffffff"
                fgColor="#111111"
                level="H"
                imageSettings={avatarUrl ? {
                  src: avatarUrl,
                  height: 48,
                  width: 48,
                  excavate: true,
                } : undefined}
              />
            </div>

            {/* Name below QR, inside white card */}
            <div className="text-center pt-1">
              <p className="text-[15px] font-bold text-gray-900 leading-tight">{name}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">@{username}</p>
            </div>

            <p className="text-[9px] text-gray-400 tracking-wide">{profileUrl}</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 bg-sidebar px-4 py-3">
            <button
              onClick={handleDownload}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-accent/60 py-2 text-[12px] font-medium transition-colors hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share profile to…"
        payload={{ content: buildProfilePayload(name, username, avatarUrl) }}
      />
    </>
  )
}
