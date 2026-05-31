'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface Note {
  id: string
  title: string
  snippet: string
  body: string
  date: string
  tag: string
}

interface NotesPanelProps {
  scopeKey?: string
  scopeLabel?: string
  scopeType?: 'group' | 'personal'
}

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  Design: { bg: 'rgba(91,164,245,0.12)', color: '#5ba4f5' },
  Planning: { bg: 'rgba(79,209,160,0.12)', color: '#4fd1a0' },
  Research: { bg: 'rgba(167,139,247,0.14)', color: '#a78bf7' },
  Personal: { bg: 'rgba(240,180,80,0.14)', color: '#f0b450' },
}

const INITIAL_NOTES_BY_SCOPE: Record<string, Note[]> = {
  'personal-notes': [
    {
      id: 'pn-1',
      title: 'Profile polish backlog',
      snippet: 'Reduce vertical spacing, tighten showroom entry, and keep section headers quieter.',
      body: 'Reduce vertical spacing in profile, tighten the showroom entry, and keep section headers quieter so the page reads faster. The profile shell should stay premium without oversized cards.',
      date: 'Today, 08:10',
      tag: 'Personal',
    },
    {
      id: 'pn-2',
      title: 'Follow up with game room spec',
      snippet: 'Future room state needs trophies, featured builds, and a compact status line.',
      body: 'Future room state needs trophies, featured builds, and a compact status line in profile. Keep the final room surface separate from the chat shell.',
      date: 'Yesterday',
      tag: 'Planning',
    },
  ],
  'twiky-studio-general': [
    {
      id: 'tsn-1',
      title: 'Studio weekly note',
      snippet: 'Navigation should stay compact, obvious, and split clearly between personal and channel surfaces.',
      body: 'Navigation should stay compact, obvious, and split clearly between personal and channel surfaces. Direct messages must remain independent from feed-like channels.',
      date: 'Today, 09:30',
      tag: 'Planning',
    },
  ],
  'design-lab-ui-critique': [
    {
      id: 'dln-1',
      title: 'Typography pass',
      snippet: 'Lower the default text sizes across profile, settings, and chat sidebars.',
      body: 'Lower the default text sizes across profile, settings, and chat sidebars. The UI should feel denser and more deliberate, not oversized.',
      date: 'Today, 11:12',
      tag: 'Design',
    },
  ],
  'game-room-showroom': [
    {
      id: 'grn-1',
      title: 'Showroom scope',
      snippet: 'Room, trophies, and featured items should eventually sit behind the profile showroom section.',
      body: 'Room, trophies, and featured items should eventually sit behind the profile showroom section. Keep the feed, goals, and tasks scoped to the showroom group until the room system ships.',
      date: 'Yesterday',
      tag: 'Research',
    },
  ],
}

function buildScopeNotes(scopeLabel: string, scopeType: 'group' | 'personal'): Note[] {
  return [
    {
      id: `${scopeLabel}-seed-1`,
      title:
        scopeType === 'personal'
          ? 'Private follow-up'
          : `${scopeLabel} handoff note`,
      snippet:
        scopeType === 'personal'
          ? 'This note belongs only to you and stays outside channel groups.'
          : `This note belongs only to ${scopeLabel} and should not leak into other groups.`,
      body:
        scopeType === 'personal'
          ? 'This note belongs only to you and stays outside channel groups.'
          : `This note belongs only to ${scopeLabel}. Keep channel-specific context here instead of mixing it with personal planning.`,
      date: 'Today',
      tag: scopeType === 'personal' ? 'Personal' : 'Planning',
    },
  ]
}

export function NotesPanel({
  scopeKey = 'personal-notes',
  scopeLabel = 'Personal',
  scopeType = 'personal',
}: NotesPanelProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Note | null>(null)
  const [localNotesByScope, setLocalNotesByScope] = useState(INITIAL_NOTES_BY_SCOPE)

  const notes = useMemo(() => {
    return localNotesByScope[scopeKey] ?? buildScopeNotes(scopeLabel, scopeType)
  }, [scopeKey, scopeLabel, scopeType, localNotesByScope])

  function openNote(note: Note) {
    setSelected(note)
    setOpen(true)
  }

  function deleteNote(id: string) {
    setLocalNotesByScope(prev => ({
      ...prev,
      [scopeKey]: (prev[scopeKey] || []).filter(n => n.id !== id)
    }))
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {scopeType === 'personal' ? (
          <div className="border-b border-border bg-sidebar/60 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Private notes
              </span>
              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] text-muted-foreground">
                Visible only to you
              </span>
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {notes.map((note) => {
              const colors = TAG_STYLES[note.tag] ?? TAG_STYLES.Planning

              return (
                <Card
                  key={note.id}
                  onClick={() => openNote(note)}
                  className="group relative cursor-pointer rounded-2xl border-border shadow-none transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm"
                >
                  <CardContent className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-full border-0 px-2 py-0.5 text-[9px] font-semibold"
                        style={{ background: colors.bg, color: colors.color }}
                      >
                        {note.tag}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{note.date}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNote(note.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 text-[12px] font-semibold text-foreground">
                      {note.title}
                    </p>
                    <p className="mt-1.5 line-clamp-3 text-[11px] leading-5 text-muted-foreground">
                      {note.snippet}
                    </p>
                  </CardContent>
                </Card>
              )
            })}

            <Card className="rounded-2xl border-dashed border-border bg-transparent shadow-none transition-colors hover:border-primary/30 hover:bg-primary/5">
              <CardContent className="flex min-h-[146px] flex-col items-center justify-center p-3.5 text-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full bg-muted text-muted-foreground"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                  New note
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto border-border sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader className="mb-5">
                <div className="mb-1 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    style={{
                      background: (TAG_STYLES[selected.tag] ?? TAG_STYLES.Planning).bg,
                      color: (TAG_STYLES[selected.tag] ?? TAG_STYLES.Planning).color,
                      borderColor: 'transparent',
                    }}
                    className="rounded-full text-[9px] font-semibold"
                  >
                    {selected.tag}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {selected.date}
                  </span>
                </div>
                <SheetTitle className="text-left text-[16px] font-semibold leading-snug">
                  {selected.title}
                </SheetTitle>
              </SheetHeader>
              <div className="whitespace-pre-line text-[13px] leading-7 text-foreground">
                {selected.body}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
