'use client'

import React, { useEffect, useState } from 'react'

const APPLE_CDN = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64'

const EMOJI_RE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Regional_Indicator}/u

function emojiToUnified(emoji: string): string {
  return [...emoji]
    .map(c => c.codePointAt(0)!)
    .map(cp => cp.toString(16).toLowerCase())
    .join('-')
}

function splitText(text: string): Array<{ type: 'text' | 'emoji'; value: string }> {
  try {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
    const result: Array<{ type: 'text' | 'emoji'; value: string }> = []
    let buf = ''
    for (const { segment } of segmenter.segment(text)) {
      if (EMOJI_RE.test(segment)) {
        if (buf) { result.push({ type: 'text', value: buf }); buf = '' }
        result.push({ type: 'emoji', value: segment })
      } else {
        buf += segment
      }
    }
    if (buf) result.push({ type: 'text', value: buf })
    return result
  } catch {
    return [{ type: 'text', value: text }]
  }
}

export function EmojiImg({ value, unified, size }: { value: string; unified: string; size: number }) {
  const [src, setSrc] = useState(`${APPLE_CDN}/${unified}.png`)
  const [native, setNative] = useState(false)

  useEffect(() => {
    setSrc(`${APPLE_CDN}/${unified}.png`)
    setNative(false)
  }, [unified])

  if (native) return <>{value}</>

  return (
    <img
      src={src}
      alt={value}
      draggable={false}
      style={{ width: size, height: size, display: 'inline-block', verticalAlign: '-0.2em', margin: '0 0.05em' }}
      onError={() => {
        if (src.includes('-fe0f')) {
          setSrc(src.replace(/-fe0f/g, ''))
        } else {
          setNative(true)
        }
      }}
    />
  )
}

interface AppleTextProps {
  text: string
  className?: string
  emojiSize?: number
}

export function AppleText({ text, className, emojiSize = 18 }: AppleTextProps) {
  if (!text) return null
  const parts = splitText(text)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === 'text') return <React.Fragment key={i}>{part.value}</React.Fragment>
        return <EmojiImg key={i} value={part.value} unified={emojiToUnified(part.value)} size={emojiSize} />
      })}
    </span>
  )
}
