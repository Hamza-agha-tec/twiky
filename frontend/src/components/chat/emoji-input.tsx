'use client'

import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { cn } from '@/lib/utils'

const APPLE_CDN = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64'
const EMOJI_RE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Regional_Indicator}/u

function emojiToUnified(emoji: string): string {
  return [...emoji]
    .map(c => c.codePointAt(0)!)
    .map(cp => cp.toString(16).toLowerCase())
    .join('-')
}

const ONERROR = `if(this.src.includes('-fe0f')){this.src=this.src.replace(/-fe0f/g,'');}else{this.style.display='none';}`

function unifiedToEmoji(unified: string): string {
  try {
    return String.fromCodePoint(...unified.split('-').map(h => parseInt(h, 16)))
  } catch {
    return unified
  }
}

function splitGraphemes(text: string): Array<{ type: 'text' | 'emoji'; value: string }> {
  try {
    const seg = new Intl.Segmenter('en', { granularity: 'grapheme' })
    const result: Array<{ type: 'text' | 'emoji'; value: string }> = []
    let buf = ''
    for (const { segment } of seg.segment(text)) {
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

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
}

function textToHtml(text: string): string {
  return splitGraphemes(text).map(part => {
    if (part.type === 'text') return escapeHtml(part.value)
    const unified = emojiToUnified(part.value)
    return `<img src="${APPLE_CDN}/${unified}.png" alt="${part.value}" data-emoji="1" onerror="${ONERROR}" style="width:18px;height:18px;display:inline-block;vertical-align:-0.25em;margin:0 0.03em;pointer-events:none" draggable="false">`
  }).join('')
}

export function extractText(el: HTMLElement): string {
  let text = ''
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ''
    } else if ((node as Element).tagName === 'IMG') {
      text += (node as HTMLImageElement).alt
    } else if ((node as Element).tagName === 'BR') {
      text += '\n'
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      text += extractText(node as HTMLElement)
    }
  }
  return text
}

export function getCaretCharOffset(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0)
  const pre = range.cloneRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.startContainer, range.startOffset)
  const tmp = document.createElement('div')
  tmp.appendChild(pre.cloneContents())
  return extractText(tmp).length
}

function moveCursorToEnd(el: HTMLElement) {
  el.focus()
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

function setCursorAt(el: HTMLElement, offset: number) {
  el.focus()
  // Walk nodes counting chars until we hit offset
  const sel = window.getSelection()
  if (!sel) return
  let remaining = offset
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? '').length
      if (remaining <= len) {
        const range = document.createRange()
        range.setStart(node, remaining)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        return true
      }
      remaining -= len
    } else if ((node as Element).tagName === 'IMG') {
      if (remaining === 0) {
        const range = document.createRange()
        range.setStartBefore(node)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        return true
      }
      remaining -= (node as HTMLImageElement).alt.length
    } else {
      for (const child of Array.from(node.childNodes)) {
        if (walk(child)) return true
      }
    }
    return false
  }
  walk(el)
}

export interface EmojiInputHandle {
  focus: () => void
  clear: () => void
  insertEmoji: (emoji: string) => void
  getCaretOffset: () => number
  setCaretOffset: (offset: number) => void
}

interface EmojiInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onKeyUp?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void
  onSelect?: (e: React.SyntheticEvent<HTMLDivElement>) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export const EmojiInput = forwardRef<EmojiInputHandle, EmojiInputProps>(({
  value, onChange, onKeyDown, onKeyUp, onClick, onBlur, onSelect, placeholder, disabled, className,
}, ref) => {
  const divRef = useRef<HTMLDivElement>(null)
  const isUserInput = useRef(false)

  useImperativeHandle(ref, () => ({
    focus: () => { divRef.current?.focus() },
    clear: () => { if (divRef.current) { divRef.current.innerHTML = ''; divRef.current.focus() } },
    insertEmoji: (unified: string) => {
      const el = divRef.current
      if (!el) return
      el.focus()
      const img = document.createElement('img')
      img.src = `${APPLE_CDN}/${unified}.png`
      img.alt = unifiedToEmoji(unified)
      img.setAttribute('data-emoji', '1')
      img.style.cssText = 'width:18px;height:18px;display:inline-block;vertical-align:-0.25em;margin:0 0.03em;pointer-events:none'
      img.onerror = () => {
        if (img.src.includes('-fe0f')) {
          img.onerror = null
          img.src = img.src.replace(/-fe0f/g, '')
        } else {
          img.style.display = 'none'
        }
      }
      img.draggable = false
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        range.insertNode(img)
        range.setStartAfter(img)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      } else {
        el.appendChild(img)
        moveCursorToEnd(el)
      }
      isUserInput.current = true
      onChange(extractText(el))
    },
    getCaretOffset: () => divRef.current ? getCaretCharOffset(divRef.current) : 0,
    setCaretOffset: (offset: number) => { if (divRef.current) setCursorAt(divRef.current, offset) },
  }))

  // Sync external value changes (e.g. clear after send, mention insertion)
  useEffect(() => {
    if (isUserInput.current) { isUserInput.current = false; return }
    const el = divRef.current
    if (!el) return
    if (value === '') {
      el.innerHTML = ''
    } else {
      const current = extractText(el)
      if (current !== value) {
        el.innerHTML = textToHtml(value)
        moveCursorToEnd(el)
      }
    }
  }, [value])

  const handleInput = useCallback(() => {
    const el = divRef.current
    if (!el) return
    isUserInput.current = true
    onChange(extractText(el))
  }, [onChange])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertHTML', false, textToHtml(text))
    isUserInput.current = true
    if (divRef.current) onChange(extractText(divRef.current))
  }, [onChange])

  return (
    <div
      ref={divRef}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onClick={onClick}
      onBlur={onBlur}
      onSelect={onSelect}
      onPaste={handlePaste}
      data-placeholder={placeholder}
      className={cn(
        'outline-none break-words whitespace-pre-wrap',
        'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/60 empty:before:pointer-events-none empty:before:select-none',
        className
      )}
    />
  )
})

EmojiInput.displayName = 'EmojiInput'
