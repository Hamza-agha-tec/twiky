'use client'

import { type ChangeEvent, FormEvent, useRef, useState } from 'react'
import { AudioLines, Globe, Hash, ImagePlus, Lock, Bird , Popcorn, UserCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export interface CreateEntityValues {
  description: string
  name: string
  avatarFile?: File | null
  bannerFile?: File | null
  access_type?: 'PUBLIC' | 'PRIVATE'
  group_type?: 'text' | 'board' | 'voice' | 'watch'
  type?: 'NORMAL' | 'WORKSPACE'
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
  onSubmit: (values: CreateEntityValues) => void | Promise<void>
  open: boolean
  submitLabel: string
  title: string
}

const GROUP_TYPES = [
  {
    value: 'text' as const,
    icon: Hash,
    label: 'Text',
    desc: 'Messages & threads',
    gradient: 'from-violet-500/20 to-purple-500/10',
    color: 'text-violet-400',
    border: 'border-violet-500/30',
  },
  {
    value: 'board' as const,
    icon: Bird ,
    label: 'Forum',
    desc: 'Forum-style posts',
    gradient: 'from-blue-500/20 to-cyan-500/10',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  {
    value: 'voice' as const,
    icon: AudioLines,
    label: 'Voice',
    desc: 'Live audio rooms',
    gradient: 'from-emerald-500/20 to-green-500/10',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  {
    value: 'watch' as const,
    icon: Popcorn,
    label: 'Watch',
    desc: 'Watch together',
    gradient: 'from-amber-500/20 to-orange-500/10',
    color: 'text-amber-400',
    border: 'border-amber-500/30',
  },
] as const

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
  const [groupType, setGroupType] = useState<'text' | 'board' | 'voice' | 'watch'>('text')
  const [groupAccess, setGroupAccess] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const bannerRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  const previewName = name.trim() || (entityKind === 'channel' ? 'Creator Hub' : 'showroom-updates')
  const activeType = GROUP_TYPES.find((t) => t.value === groupType) ?? GROUP_TYPES[0]

  function handleOpenChange(nextOpen: boolean) {
    setName(defaultName); setDetails(defaultDescription)
    setAccessType('PUBLIC'); setGroupType('text'); setGroupAccess('PUBLIC')
    setBannerUrl(null); setAvatarUrl(null); setBannerFile(null); setAvatarFile(null)
    setSubmitError(null); setIsSubmitting(false)
    onOpenChange(nextOpen)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) return
    setSubmitError(null); setIsSubmitting(true)
    try {
      await onSubmit({
        name: nextName,
        description: details.trim(),
        avatarFile: entityKind === 'channel' ? avatarFile : null,
        bannerFile: entityKind === 'channel' ? bannerFile : null,
        access_type: entityKind === 'channel' ? accessType : groupAccess,
        group_type: entityKind === 'group' ? groupType : undefined,
      })
      handleOpenChange(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create item')
      setIsSubmitting(false)
    }
  }

  function handleBannerChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBannerFile(file); setBannerUrl(URL.createObjectURL(file))
  }

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setAvatarFile(file); setAvatarUrl(URL.createObjectURL(file))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(
        '!w-[min(calc(100%-1.5rem),52rem)] !max-w-[52rem] p-0 gap-0 overflow-hidden',
      )}>
        {/* Header */}
        <div className="px-7 pt-6 pb-5 border-b border-border/40">
          <span className="inline-flex items-center rounded-full bg-muted/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            {entityKind === 'channel' ? 'New channel' : 'New group'}
          </span>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-7 py-6">
            {entityKind === 'group' ? (
              <div className="grid grid-cols-[1fr_1.1fr] gap-8">
                {/* Left: type + access */}
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3">Group type</p>
                    <div className="grid grid-cols-2 gap-2">
                      {GROUP_TYPES.map(({ value, icon: Icon, label, desc, gradient, color, border }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setGroupType(value)}
                          className={cn(
                            'relative flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all duration-200',
                            groupType === value
                              ? `bg-gradient-to-br ${gradient} ${border} border shadow-sm`
                              : 'border-border/50 hover:border-border hover:bg-muted/40',
                          )}
                        >
                          <div className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg',
                            groupType === value ? `bg-gradient-to-br ${gradient} border ${border}` : 'bg-muted',
                          )}>
                            <Icon className={cn('h-4 w-4', groupType === value ? color : 'text-muted-foreground')} />
                          </div>
                          <div>
                            <p className={cn('text-[12px] font-semibold', groupType === value ? 'text-foreground' : 'text-foreground/80')}>{label}</p>
                            <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{desc}</p>
                          </div>
                          {groupType === value && (
                            <div className={cn('absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full', color.replace('text-', 'bg-'))} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Access */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3">Access</p>
                    <div className="flex rounded-xl border border-border/50 overflow-hidden">
                      {(['PUBLIC', 'PRIVATE'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setGroupAccess(v)}
                          className={cn(
                            'flex flex-1 items-center justify-center gap-2 py-2.5 text-[12px] font-medium transition-all',
                            groupAccess === v ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                          )}
                        >
                          {v === 'PRIVATE' ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                          {v === 'PRIVATE' ? 'Private' : 'Public'}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground/70">
                      {groupAccess === 'PRIVATE' ? 'Members must request to join.' : 'All channel members can access.'}
                    </p>
                  </div>
                </div>

                {/* Right: preview + fields */}
                <div className="space-y-5">
                  {/* Preview */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3">Preview</p>
                    <div className={cn('rounded-xl border p-4 bg-gradient-to-br', activeType.gradient, activeType.border)}>
                      <div className="flex items-center gap-3">
                        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background/60', activeType.border)}>
                          <activeType.icon className={cn('h-5 w-5', activeType.color)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[13px] font-bold text-foreground">
                              {groupType === 'board' ? 'Forum: ' : groupType !== 'voice' && groupType !== 'watch' ? '#' : ''}{previewName}
                            </p>
                            {groupAccess === 'PRIVATE' && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {contextLabel ? `Inside ${contextLabel}` : 'Added to channel'} · {groupAccess === 'PRIVATE' ? 'Private' : 'Public'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Name */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">{nameLabel}</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={namePlaceholder}
                      className="h-10 rounded-xl border-border/60 bg-muted/30 text-[13px] focus:border-border"
                      autoFocus
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">{descriptionLabel}</label>
                    <Textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder={descriptionPlaceholder}
                      className="min-h-[80px] rounded-xl border-border/60 bg-muted/30 text-[13px] leading-relaxed resize-none focus:border-border"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Channel form */
              <div className="space-y-5">
                {/* Avatar + Banner */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3">Media</p>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => avatarRef.current?.click()}
                        className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border/60 bg-muted/40 transition-all hover:border-border hover:bg-muted/70"
                      >
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-muted-foreground/60">
                            <UserCircle2 className="h-6 w-6" />
                            <span className="text-[9px] font-medium">Avatar</span>
                          </div>
                        )}
                        {avatarUrl && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                            <UserCircle2 className="h-5 w-5 text-white" />
                          </div>
                        )}
                      </button>
                      <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </div>

                    <div className="flex-1 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => bannerRef.current?.click()}
                        className="group relative flex h-20 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border/60 bg-muted/40 transition-all hover:border-border hover:bg-muted/70"
                      >
                        {bannerUrl ? (
                          <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-muted-foreground/60">
                            <ImagePlus className="h-6 w-6" />
                            <span className="text-[9px] font-medium">Banner image</span>
                          </div>
                        )}
                        {bannerUrl && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                            <ImagePlus className="h-5 w-5 text-white" />
                          </div>
                        )}
                      </button>
                      <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">{nameLabel}</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={namePlaceholder}
                      className="h-10 rounded-xl border-border/60 bg-muted/30 text-[13px]"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Access</label>
                    <div className="flex h-10 rounded-xl border border-border/50 overflow-hidden">
                      {(['PUBLIC', 'PRIVATE'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setAccessType(v)}
                          className={cn(
                            'flex flex-1 items-center justify-center gap-1.5 text-[11px] font-medium transition-all',
                            accessType === v ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {v === 'PRIVATE' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                          {v === 'PRIVATE' ? 'Private' : 'Public'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">{descriptionLabel}</label>
                  <Textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder={descriptionPlaceholder}
                    className="min-h-[80px] rounded-xl border-border/60 bg-muted/30 text-[13px] leading-relaxed resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border/40 px-7 py-4">
            {submitError ? (
              <p className="text-[12px] text-destructive">{submitError}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground/50">
                {entityKind === 'group' ? `${activeType.label} group · ${groupAccess === 'PRIVATE' ? 'Private' : 'Public'}` : '#general added automatically'}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="rounded-xl bg-white text-black px-5 py-2 text-sm font-semibold hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? 'Creating…' : submitLabel}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
