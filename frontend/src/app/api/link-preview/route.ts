import { NextRequest, NextResponse } from 'next/server'
import { lookup } from 'dns/promises'

const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1$|fc00:|fd)/

async function isPrivateHost(hostname: string): Promise<boolean> {
  if (PRIVATE_IP_RE.test(hostname)) return true
  try {
    const { address } = await lookup(hostname)
    return PRIVATE_IP_RE.test(address)
  } catch {
    return false
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function extractMeta(html: string) {
  const get = (prop: string) => {
    const m =
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))
    return m?.[1] ?? null
  }

  const title =
    get('og:title') ||
    html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ||
    null

  const description = get('og:description') || get('description')
  const image_url = get('og:image')
  const site_name = get('og:site_name')

  const faviconMatch =
    html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i)
  const favicon = faviconMatch?.[1] ?? null

  return {
    title: title ? decodeHtmlEntities(title) : null,
    description: description ? decodeHtmlEntities(description) : null,
    image_url,
    site_name: site_name ? decodeHtmlEntities(site_name) : null,
    favicon,
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ error: 'Bad protocol' }, { status: 400 })
  }

  if (await isPrivateHost(parsed.hostname)) {
    return NextResponse.json({ error: 'Private host' }, { status: 403 })
  }

  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(raw, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TwikyBot/1.0)' },
    })
    clearTimeout(tid)

    const ct = res.headers.get('content-type') ?? ''
    if (!ct.startsWith('text/html')) {
      return NextResponse.json({ error: 'Not HTML' }, { status: 422 })
    }

    const reader = res.body?.getReader()
    if (!reader) return NextResponse.json({ error: 'No body' }, { status: 422 })

    const cap = 1_048_576 // 1 MB
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done || !value) break
      total += value.length
      if (total > cap) { reader.cancel(); break }
      chunks.push(value)
    }

    const html = new TextDecoder().decode(
      chunks.reduce((acc, c) => {
        const merged = new Uint8Array(acc.length + c.length)
        merged.set(acc); merged.set(c, acc.length)
        return merged
      }, new Uint8Array(0))
    )

    const meta = extractMeta(html)

    // Resolve relative favicon
    if (meta.favicon && !meta.favicon.startsWith('http')) {
      meta.favicon = new URL(meta.favicon, parsed.origin).href
    }

    return NextResponse.json({ url: raw, ...meta })
  } catch (e: any) {
    if (e?.name === 'AbortError') return NextResponse.json({ error: 'Timeout' }, { status: 504 })
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })
  }
}
