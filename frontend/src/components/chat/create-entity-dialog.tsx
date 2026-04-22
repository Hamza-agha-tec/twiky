'use client'

import { FormEvent, useRef, useState } from 'react'
import { Hash, ImagePlus, MessagesSquare, Sparkles, UserCircle2 } from 'lucide-react'
import { type ChangeEvent, FormEvent, useRef, useState } from 'react'
import { Globe, Hash, ImagePlus, Lock, MessagesSquare, UserCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export interface CreateEntityValues {
  description: string
  name: string
  avatarFile?: File | null
  bannerFile?: File | null
  access_type?: 'PUBLIC' | 'PRIVATE'
}

interface CreateEntityDialogProps {
  contextLabel?: string
  defaultDescription?: string
  defaultName?: string
  description: string
  descriptionLabel: string
  descriptionPlaceholder: string
  entityKind: 'channel' | 'group'
  nameLabel: string
  namePlaceholder: string
  onOpenChange: (open: boolean) => void
  onSubmit: (values: { description: string; name: string; type?: 'NORMAL' | 'WORKSPACE' }) => void
  onSubmit: (values: CreateEntityValues) => void | Promise<void>
  open: boolean
  submitLabel: string
  title: string
}

export function CreateEntityDialog({
  contextLabel,
  defaultDescription = '',
  defaultName = '',
  description,
  descriptionLabel,
  descriptionPlaceholder,
  entityKind,
  nameLabel,
  namePlaceholder,
  onOpenChange,
  onSubmit,
  open,
  submitLabel,
  title,
}: CreateEntityDialogProps) {
  const [name, setName] = useState(defaultName)
  const [details, setDetails] = useState(defaultDescription)
  const [accessType, setAccessType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const bannerRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  const previewName = name.trim() || (entityKind === 'channel' ? 'Creator Hub' : 'showroom-updates')
  const previewMonogram = previewName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || 'CH'

  function handleOpenChange(nextOpen: boolean) {
    setName(defaultName)
    setDetails(defaultDescription)
    setAccessType('PUBLIC')
    setBannerUrl(null)
    setAvatarUrl(null)
    setBannerFile(null)
    setAvatarFile(null)
    setSubmitError(null)
    setIsSubmitting(false)
    onOpenChange(nextOpen)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) return
    onSubmit({ name: nextName, description: details.trim(), type: entityKind === 'channel' ? type : undefined })
    handleOpenChange(false)
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await onSubmit({
        name: nextName,
        description: details.trim(),
        avatarFile: entityKind === 'channel' ? avatarFile : null,
        bannerFile: entityKind === 'channel' ? bannerFile : null,
        access_type: entityKind === 'channel' ? accessType : undefined,
      })
      handleOpenChange(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create item')
      setIsSubmitting(false)
    }
  }

  function handleBannerChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerFile(file)
    setBannerUrl(URL.createObjectURL(file))
  }

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarUrl(URL.createObjectURL(file))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'overflow-hidden border-border p-0 shadow-2xl',
          entityKind === 'channel' ? 'sm:max-w-[400px]' : 'sm:max-w-[320px]',
        )}
      >
        <DialogHeader className="border-b border-border bg-sidebar/80 px-3 py-3">
          <div className="inline-flex w-fit items-center rounded-full border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {entityKind === 'channel' ? 'New channel' : 'New group'}
          </div>
          <DialogTitle className="pt-1 text-[14px]">{title}</DialogTitle>
          <DialogDescription className="text-[11px] leading-5">{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 px-3 py-3">
          {/* Channel: avatar + banner as separate upload zones */}
          {entityKind === 'channel' ? (
            <div className="flex gap-2">
              {/* Avatar upload */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Avatar</span>
                <button
                  type="button"
                  onClick={() => avatarRef.current?.click()}
                  className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 transition-colors hover:bg-muted/70"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <UserCircle2 className="h-5 w-5" />
                      <span className="text-[9px]">Upload</span>
                    </div>
                  )}
                  {avatarUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <UserCircle2 className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              {/* Banner upload */}
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] text-muted-foreground">Banner</span>
                <button
                  type="button"
                  onClick={() => bannerRef.current?.click()}
                  className="group relative flex h-16 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 transition-colors hover:bg-muted/70"
                >
                  {bannerUrl ? (
                    <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-[9px]">Upload</span>
                    </div>
                  )}
                  {bannerUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <ImagePlus className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
                <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
              </div>
            </div>
          ) : (
            /* Group: keep existing preview */
            <div className="rounded-2xl border border-border bg-sidebar/50 p-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Preview
              </p>
              <div className="mt-2 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-[10px] font-bold text-white">
                  <Hash className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-foreground">
                    #{previewName}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                    {contextLabel
                      ? `This group will live inside ${contextLabel}.`
                      : 'This group will be added to the current channel.'}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-2 py-1.5">
                <Hash className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground">
                  Tasks, notes, and goals will belong to this group only
                </span>
              </div>
            </div>
          )}

          {/* Channel info hint + visibility toggle */}
          {entityKind === 'channel' ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-2 py-1.5">
                <MessagesSquare className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground">
                  #general is ready from the start
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2">
                {accessType === 'PRIVATE' ? (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="flex-1 text-[11px] font-medium text-foreground">
                  {accessType === 'PRIVATE' ? 'Private' : 'Public'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {accessType === 'PRIVATE' ? 'Invite only' : 'Anyone can join'}
                </span>
                <button
                  type="button"
                  onClick={() => setAccessType((v) => (v === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'))}
                  className={cn(
                    'relative ml-1 inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none',
                    accessType === 'PRIVATE' ? 'bg-primary' : 'bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                      accessType === 'PRIVATE' ? 'translate-x-4' : 'translate-x-0',
                    )}
                  />
                </button>
              </div>
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="entity-name" className="text-[11px]">
              {nameLabel}
            </Label>
            <Input
              id="entity-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={namePlaceholder}
              className="h-10 rounded-xl border-border bg-background text-[12px]"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entity-description" className="text-[11px]">
              {descriptionLabel}
            </Label>
            <Textarea
              id="entity-description"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder={descriptionPlaceholder}
              className="min-h-14 rounded-xl border-border bg-background text-[12px] leading-5"
            />
          </div>

          <DialogFooter className="border-t border-border px-0 pt-3">
            {submitError ? (
              <p className="mr-auto self-center text-[11px] text-destructive">{submitError}</p>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl px-4" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
