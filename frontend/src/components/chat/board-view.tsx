'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Heart,
  MessageCircle,
  Pin,
  Lock,
  MoreHorizontal,
  Plus,
  ArrowLeft,
  Send,
  Trash2,
  PencilLine,
  ChevronDown,
  ChevronUp,
  Tag,
  X,
  ImagePlus,
  Share2,
  Smile,
  Globe,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/chat/user-avatar'
import { HoverProfileCard } from '@/components/chat/hover-profile-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useBoardPosts,
  useBoardTags,
  useBoardComments,
  useBoardRealtime,
  useCreateBoardPost,
  useUpdateBoardPost,
  useDeleteBoardPost,
  useLikeBoardPost,
  useAddBoardComment,
  useDeleteBoardComment,
  useCreateBoardTag,
  useDeleteBoardTag,
} from '@/hooks/use-boards'
import type { BoardPost, BoardComment, BoardTag } from '@/lib/boards-api'
import { filesApi } from '@/lib/files-api'
import {
  VerifiedBadge,
  getVerifiedBadgeVariant,
  hasPremiumPlan,
} from '@/components/chat/verified-badge'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function nameClass(_subPlan?: string | null) {
  return 'text-white'
}

// ─── Tag Chip ─────────────────────────────────────────────────────────────────

function TagChip({ tag, onRemove }: { tag: BoardTag; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
      style={{ backgroundColor: tag.color + '18', color: tag.color, border: `1px solid ${tag.color}28` }}
    >
      {tag.name}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}

// ─── Channel Avatar ───────────────────────────────────────────────────────────

function ChannelAvatarIcon({ src, name, size = 'md' }: { src?: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'h-6 w-6 text-[10px]' : size === 'lg' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-xs'
  if (src) {
    return <img src={src} alt={name} className={cn('rounded-xl object-cover shrink-0', dims)} />
  }
  const initials = name.slice(0, 2).toUpperCase()
  return (
    <div className={cn('rounded-xl bg-muted flex items-center justify-center font-bold text-muted-foreground shrink-0', dims)}>
      {initials}
    </div>
  )
}

// ─── Image Slider ─────────────────────────────────────────────────────────────

function ImageSlider({ urls, className, maxHeight }: { urls: string[]; className?: string; maxHeight?: number }) {
  const [index, setIndex] = useState(0)
  if (urls.length === 0) return null

  function prev(e: React.MouseEvent) {
    e.stopPropagation()
    setIndex((i) => (i - 1 + urls.length) % urls.length)
  }
  function next(e: React.MouseEvent) {
    e.stopPropagation()
    setIndex((i) => (i + 1) % urls.length)
  }

  return (
    <div className={cn('relative overflow-hidden rounded-xl flex justify-center bg-muted/20', className)}>
      <img
        key={index}
        src={urls[index]}
        alt=""
        className="block rounded-xl animate-in fade-in duration-200"
        style={maxHeight ? { maxHeight, width: 'auto', objectFit: 'contain' } : { width: '100%', height: 'auto' }}
      />

      {/* Arrows */}
      {urls.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}

      {/* Dots */}
      {urls.length > 1 && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {urls.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setIndex(i) }}
              className={cn(
                'rounded-full transition-all duration-200',
                i === index ? 'bg-white w-4 h-1.5' : 'bg-white/50 w-1.5 h-1.5 hover:bg-white/80',
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Create Post Modal ────────────────────────────────────────────────────────

const VISIBILITY_OPTIONS = [
  { value: 'everyone', label: 'Everyone', icon: Globe, desc: 'Visible to all members' },
  { value: 'members', label: 'Members only', icon: Users, desc: 'Only group members' },
]

function CreatePostModal({
  groupId,
  groupName,
  channelName,
  channelAvatar,
  open,
  onClose,
  isAdmin,
  authorName,
  authorAvatar,
}: {
  groupId: string
  groupName: string
  channelName?: string
  channelAvatar?: string
  open: boolean
  onClose: () => void
  isAdmin: boolean
  authorName?: string
  authorAvatar?: string
}) {
  const { data: allTags = [] } = useBoardTags(groupId)
  const createPost = useCreateBoardPost(groupId)
  const createTag = useCreateBoardTag(groupId)
  const deleteTag = useDeleteBoardTag(groupId)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#8b5cf6')
  const [showTagManager, setShowTagManager] = useState(false)
  const [visibility, setVisibility] = useState('everyone')
  const [step, setStep] = useState<'write' | 'preview'>('write')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setTitle(''); setContent(''); setSelectedTagIds([]); setMediaUrls([])
    setNewTagName(''); setShowTagManager(false); setStep('write'); setVisibility('everyone')
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const uploads = await Promise.all(files.map((f) => filesApi.uploadMessageFile(f)))
      setMediaUrls((prev) => [...prev, ...uploads.map((u) => u.url)])
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSubmit() {
    if (!title.trim()) return
    await createPost.mutateAsync({
      title: title.trim(),
      content: content.trim() || undefined,
      media_urls: mediaUrls,
      tag_ids: selectedTagIds,
    })
    reset(); onClose()
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id])
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return
    await createTag.mutateAsync({ name: newTagName.trim(), color: newTagColor })
    setNewTagName('')
  }

  const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id))
  const charCount = content.length
  const maxChars = 2000

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="!w-[min(calc(100%-1.5rem),56rem)] !max-w-[56rem] p-0 overflow-hidden gap-0">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ChannelAvatarIcon src={channelAvatar} name={channelName ?? groupName} size="sm" />
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{channelName}</span>
                <span>/</span>
                <span>{groupName}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep(step === 'write' ? 'preview' : 'write')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                step === 'preview'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              {step === 'write' ? 'Preview' : 'Edit'}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[70vh]">
          {step === 'write' ? (
            <div className="p-6 space-y-5">
              {/* Author + visibility */}
              <div className="flex items-center gap-3">
                {authorAvatar ? (
                  <img src={authorAvatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0 ring-2 ring-border/40" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-none mb-1">{authorName ?? 'You'}</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1 rounded-md bg-muted/70 hover:bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors">
                        {visibility === 'everyone'
                          ? <><Globe className="h-2.5 w-2.5" /> Everyone</>
                          : <><Users className="h-2.5 w-2.5" /> Members only</>
                        }
                        <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {VISIBILITY_OPTIONS.map((opt) => (
                        <DropdownMenuItem key={opt.value} onClick={() => setVisibility(opt.value)} className="flex-col items-start gap-0.5 py-2">
                          <div className="flex items-center gap-2 font-medium text-sm">
                            <opt.icon className="h-3.5 w-3.5" />{opt.label}
                          </div>
                          <span className="text-[11px] text-muted-foreground pl-5">{opt.desc}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Title *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your post a title…"
                  className="w-full bg-transparent text-xl font-bold placeholder:text-muted-foreground/40 placeholder:font-normal focus:outline-none border-none p-0 resize-none"
                />
              </div>

              {/* Divider */}
              <div className="h-px bg-border/40" />

              {/* Content */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, maxChars))}
                  placeholder="Share something with the community…"
                  rows={6}
                  className="w-full resize-none bg-transparent text-sm text-foreground/90 placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed border-none p-0"
                />
                <div className="flex justify-end">
                  <span className={cn('text-[10px] tabular-nums', charCount > maxChars * 0.9 ? 'text-amber-500' : 'text-muted-foreground/50')}>
                    {charCount}/{maxChars}
                  </span>
                </div>
              </div>

              {/* Media */}
              {mediaUrls.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Media</label>
                  <div className="grid grid-cols-4 gap-2">
                    {mediaUrls.map((url, i) => (
                      <div key={i} className="relative group aspect-square">
                        <img src={url} alt="" className="h-full w-full rounded-xl object-cover" />
                        <button
                          onClick={() => setMediaUrls((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground/80 p-0.5 text-background opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {mediaUrls.length < 8 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="aspect-square rounded-xl border-2 border-dashed border-border/60 flex items-center justify-center text-muted-foreground/50 hover:border-border hover:text-muted-foreground transition-all disabled:opacity-50"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {(allTags.length > 0 || isAdmin) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Tags</label>
                    {isAdmin && (
                      <button
                        onClick={() => setShowTagManager((v) => !v)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {showTagManager ? 'Done' : 'Manage'}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map((tag) => {
                      const selected = selectedTagIds.includes(tag.id)
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          className={cn(
                            'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide border transition-all',
                            selected ? 'opacity-100 scale-100' : 'opacity-40 hover:opacity-70 hover:scale-95',
                          )}
                          style={{
                            backgroundColor: selected ? tag.color + '20' : 'transparent',
                            borderColor: tag.color + (selected ? '60' : '40'),
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </button>
                      )
                    })}
                    {allTags.length === 0 && isAdmin && (
                      <p className="text-[12px] text-muted-foreground/50">No tags yet. Create one below.</p>
                    )}
                  </div>

                  {showTagManager && isAdmin && (
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={newTagColor}
                          onChange={(e) => setNewTagColor(e.target.value)}
                          className="h-9 w-9 cursor-pointer rounded-lg border border-border/60 bg-transparent p-0.5 shrink-0"
                        />
                        <Input
                          placeholder="Tag name"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTag() }}
                          className="h-9 text-sm flex-1"
                        />
                        <Button size="sm" variant="outline" onClick={handleCreateTag} className="h-9 shrink-0">Add</Button>
                      </div>
                      {allTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {allTags.map((tag) => (
                            <TagChip key={tag.id} tag={tag} onRemove={() => deleteTag.mutate(tag.id)} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Preview */
            <div className="p-6">
              <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
                  {authorAvatar ? (
                    <img src={authorAvatar} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-border/40" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted" />
                  )}
                  <div>
                    <p className="text-[13px] font-semibold">{authorName ?? 'You'}</p>
                    <p className="text-[11px] text-muted-foreground">Just now</p>
                  </div>
                  {selectedTags[0] && (
                    <span className="ml-auto text-[10px] font-semibold" style={{ color: selectedTags[0].color }}>
                      {selectedTags[0].name}
                    </span>
                  )}
                </div>
                {title && <h2 className="px-4 pb-2 text-[15px] font-bold leading-snug">{title}</h2>}
                {content && <p className="px-4 pb-3 text-[13px] text-muted-foreground leading-relaxed line-clamp-4">{content}</p>}
                {mediaUrls[0] && (
                  <div className="mx-4 mb-3 overflow-hidden rounded-xl">
                    <img src={mediaUrls[0]} alt="" className="w-full object-cover max-h-52" />
                  </div>
                )}
                <div className="flex items-center gap-4 border-t border-border/40 px-4 py-2.5 text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-[13px]"><Heart className="h-4 w-4" /></span>
                  <span className="flex items-center gap-1.5 text-[13px]"><MessageCircle className="h-4 w-4" /></span>
                  <span className="flex items-center gap-1.5 text-[13px]"><Share2 className="h-4 w-4" /><span className="text-xs">Share</span></span>
                </div>
              </div>
              {!title && (
                <p className="mt-3 text-center text-sm text-muted-foreground/60">Add a title to preview your post</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-border/50 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-40"
            >
              <ImagePlus className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Photo'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />

            <button
              onClick={() => setShowTagManager((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <Tag className="h-4 w-4" />
              Tag
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => { reset(); onClose() }}
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
            >
              Discard
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || createPost.isPending}
              className="flex items-center gap-2 rounded-xl bg-white text-black px-5 py-2 text-sm font-semibold hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-md shadow-white/10"
            >
              {createPost.isPending ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Comment Node ─────────────────────────────────────────────────────────────

function CommentNode({
  comment,
  postId,
  groupId,
  myId,
  depth = 0,
}: {
  comment: BoardComment
  postId: string
  groupId: string
  myId?: string
  depth?: number
}) {
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [showReplies, setShowReplies] = useState(true)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const addComment = useAddBoardComment(postId, groupId)
  const deleteComment = useDeleteBoardComment(postId)
  const showBadge = Boolean(comment.author.is_verified || hasPremiumPlan(comment.author.sub_plan))

  async function submitReply() {
    if (!replyText.trim()) return
    await addComment.mutateAsync({ content: replyText.trim(), parent_comment_id: comment.id })
    setReplyText(''); setReplying(false)
  }

  return (
    <div className={cn('flex gap-2.5', depth > 0 && 'ml-8 border-l-2 border-border/40 pl-3')}>
      <UserAvatar src={comment.author.avatar_url} alt={comment.author.username} className="h-7 w-7 shrink-0 rounded-full object-cover mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn('text-[13px] font-semibold leading-none', nameClass(comment.author.sub_plan))}>{comment.author.username}</span>
          {showBadge && <VerifiedBadge size="xs" variant={getVerifiedBadgeVariant(comment.author.sub_plan)} />}
          <span className="text-[11px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
        </div>
        <p className="mt-1 text-sm text-foreground/90 leading-relaxed">{comment.content}</p>
        {comment.media_urls?.length > 0 && <div className="mt-2"><ImageSlider urls={comment.media_urls} /></div>}
        <div className="mt-1 flex items-center gap-3">
          <button
            onClick={() => { setLiked(v => !v); setLikeCount(c => liked ? c - 1 : c + 1) }}
            className={cn('flex items-center gap-0.5 text-[11px] transition-colors', liked ? 'text-rose-500' : 'text-muted-foreground hover:text-rose-500')}
          >
            <Heart className={cn('h-2.5 w-2.5', liked && 'fill-current')} />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
          {depth < 3 && (
            <button onClick={() => setReplying((v) => !v)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Reply</button>
          )}
          {comment.replies?.length > 0 && (
            <button onClick={() => setShowReplies((v) => !v)} className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              {showReplies ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {comment.replies.length}
            </button>
          )}
          {myId === comment.author_id && (
            <button onClick={() => deleteComment.mutate(comment.id)} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>

        {replying && (
          <div className="mt-2 flex gap-2">
            <Input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${comment.author.username}…`}
              className="h-8 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply() } }}
            />
            <Button size="sm" className="h-8 px-2.5 shrink-0" onClick={submitReply} disabled={addComment.isPending}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {showReplies && comment.replies?.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map((reply) => (
              <CommentNode key={reply.id} comment={reply} postId={postId} groupId={groupId} myId={myId} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Post Detail ──────────────────────────────────────────────────────────────

function PostDetail({
  post,
  groupId,
  myId,
  isAdmin,
  onBack,
  onMessage,
  onViewProfile,
  scrollToComments: shouldScroll,
}: {
  post: BoardPost
  groupId: string
  myId?: string
  isAdmin: boolean
  onBack: () => void
  onMessage?: (userId: string) => void
  onViewProfile?: (userId: string, userData?: { name: string; avatarUrl: string | null }) => void
  scrollToComments?: boolean
}) {
  const commentsRef = useRef<HTMLDivElement>(null)
  const { data: comments = [] } = useBoardComments(post.id)
  const addComment = useAddBoardComment(post.id, groupId)
  const deletePost = useDeleteBoardPost(groupId)
  const updatePost = useUpdateBoardPost(post.id, groupId)
  const likePost = useLikeBoardPost(groupId)

  const [commentText, setCommentText] = useState('')
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (shouldScroll) {
      setTimeout(() => commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    }
  }, [shouldScroll])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url } = await filesApi.uploadMessageFile(file)
      setMediaUrls((prev) => [...prev, url])
    } finally { setUploading(false) }
  }

  async function submitComment() {
    if (!commentText.trim() && mediaUrls.length === 0) return
    await addComment.mutateAsync({ content: commentText.trim(), media_urls: mediaUrls })
    setCommentText(''); setMediaUrls([])
  }

  const canManage = isAdmin || myId === post.author_id

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted px-2 py-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="h-4 w-px bg-border/50" />
        <span className="text-sm font-medium truncate flex-1 text-muted-foreground">{post.title}</span>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted p-1.5">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {isAdmin && (
                <DropdownMenuItem onClick={() => updatePost.mutate({ is_pinned: !post.is_pinned })}>
                  <Pin className="mr-2 h-3.5 w-3.5" />{post.is_pinned ? 'Unpin post' : 'Pin post'}
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <DropdownMenuItem onClick={() => updatePost.mutate({ is_locked: !post.is_locked })}>
                  <Lock className="mr-2 h-3.5 w-3.5" />{post.is_locked ? 'Unlock comments' : 'Lock comments'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { deletePost.mutate(post.id); onBack() }}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />Delete post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-border/40 px-5 py-5">
          {/* Author row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <HoverProfileCard
                userId={post.author_id}
                onMessage={myId !== post.author_id ? onMessage : undefined}
                onViewProfile={onViewProfile ? (uid) => onViewProfile(uid, { name: post.author.username, avatarUrl: post.author.avatar_url }) : undefined}
                side="right"
              >
                <UserAvatar src={post.author.avatar_url} alt={post.author.username} className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-border/40 cursor-pointer" />
              </HoverProfileCard>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-sm font-semibold', nameClass(post.author.sub_plan))}>{post.author.username}</span>
                  {(post.author.is_verified || hasPremiumPlan(post.author.sub_plan)) && (
                    <VerifiedBadge size="xs" variant={getVerifiedBadgeVariant(post.author.sub_plan)} />
                  )}
                  <span className="text-[11px] text-muted-foreground/60">·</span>
                  <span className="text-[11px] text-muted-foreground/70">{timeAgo(post.created_at)}</span>
                </div>
                {post.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {post.tags.map((tag) => <TagChip key={tag.id} tag={tag} />)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {post.is_pinned && (
                <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-500">Pinned</span>
              )}
              {post.is_locked && (
                <span className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                  <Lock className="h-2.5 w-2.5" />Locked
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-xl font-bold leading-snug tracking-tight mb-4">{post.title}</h1>

          {post.content && (
            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap mb-4">{post.content}</p>
          )}
          {post.media_urls?.length > 0 && <ImageSlider urls={post.media_urls} className="mb-4" maxHeight={380} />}

          <div className="flex items-center gap-5 pt-3 border-t border-border/40">
            <button
              onClick={() => likePost.mutate({ postId: post.id, liked: post.is_liked })}
              className={cn('flex items-center gap-1.5 text-sm font-medium transition-all active:scale-90', post.is_liked ? 'text-rose-500' : 'text-muted-foreground hover:text-rose-500')}
            >
              <Heart className={cn('h-4 w-4 transition-all duration-200', post.is_liked && 'fill-current scale-110')} />
              {post.like_count > 0 && <span>{formatCount(post.like_count)}</span>}
              <span className="text-xs">{post.is_liked ? 'Liked' : 'Like'}</span>
            </button>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageCircle className="h-4 w-4" />
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
            </span>
          </div>
        </div>

        <div ref={commentsRef} className="px-5 py-4 space-y-4">
          {comments.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">No comments yet. Be the first!</p>
          )}
          {comments.map((comment) => (
            <CommentNode key={comment.id} comment={comment} postId={post.id} groupId={groupId} myId={myId} />
          ))}
        </div>
      </div>

      {!post.is_locked ? (
        <div className="border-t border-border/40 px-4 py-3 shrink-0">
          {mediaUrls.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <button
                    onClick={() => setMediaUrls((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1 -top-1 rounded-full bg-foreground/80 p-0.5 text-background opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-muted-foreground hover:text-foreground disabled:opacity-50 shrink-0 transition-colors">
              <ImagePlus className="h-4 w-4" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              className="h-9 flex-1 text-sm border-border/50"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
            />
            <Button size="sm" className="h-9 px-3 shrink-0" onClick={submitComment} disabled={addComment.isPending || (!commentText.trim() && mediaUrls.length === 0)}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5 border-t border-border/40 py-3 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />Comments are locked
        </div>
      )}
    </div>
  )
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  groupId,
  myId,
  isAdmin,
  onClick,
  index = 0,
  onMessage,
  onViewProfile,
  onCommentClick,
}: {
  post: BoardPost
  groupId: string
  myId?: string
  isAdmin: boolean
  onClick: () => void
  index?: number
  onMessage?: (userId: string) => void
  onViewProfile?: (userId: string, userData?: { name: string; avatarUrl: string | null }) => void
  onCommentClick?: () => void
}) {
  const likePost = useLikeBoardPost(groupId)
  const deletePost = useDeleteBoardPost(groupId)
  const updatePost = useUpdateBoardPost(post.id, groupId)

  const canManage = isAdmin || myId === post.author_id
  const showBadge = Boolean(post.author.is_verified || hasPremiumPlan(post.author.sub_plan))
  const hasImage = post.media_urls?.length > 0
  const firstTag = post.tags[0]

  return (
    <article
      className={cn(
        'group relative rounded-2xl border border-border/40 bg-card cursor-pointer overflow-hidden',
        'transition-all duration-300 hover:border-border/70 hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5',
        'animate-in fade-in slide-in-from-bottom-4',
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both', animationDuration: '400ms' }}
      onClick={onClick}
    >
      {/* Author row */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <HoverProfileCard
          userId={post.author_id}
          onMessage={myId !== post.author_id ? onMessage : undefined}
          onViewProfile={onViewProfile ? (uid) => onViewProfile(uid, { name: post.author.username, avatarUrl: post.author.avatar_url }) : undefined}
          side="right"
        >
          <div onClick={(e) => e.stopPropagation()}>
            <UserAvatar
              src={post.author.avatar_url}
              alt={post.author.username}
              className="h-8 w-8 rounded-full object-cover shrink-0 ring-2 ring-border/30 cursor-pointer"
            />
          </div>
        </HoverProfileCard>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn('text-[13px] font-semibold leading-none', nameClass(post.author.sub_plan))}>
              {post.author.username}
            </span>
            {showBadge && <VerifiedBadge size="xs" variant={getVerifiedBadgeVariant(post.author.sub_plan)} />}
            <span className="text-[11px] text-muted-foreground/60">·</span>
            <span className="text-[11px] text-muted-foreground/60">{timeAgo(post.created_at)}</span>
            {firstTag && (
              <>
                <span className="text-[11px] text-muted-foreground/40">·</span>
                <span className="text-[10px] font-semibold tracking-wide" style={{ color: firstTag.color }}>
                  {firstTag.name}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {post.is_pinned && (
            <span className="rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-500">
              Pinned
            </span>
          )}
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-foreground transition-all rounded-lg hover:bg-muted"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {isAdmin && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updatePost.mutate({ is_pinned: !post.is_pinned }) }}>
                    <Pin className="mr-2 h-3.5 w-3.5" />{post.is_pinned ? 'Unpin' : 'Pin'}
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updatePost.mutate({ is_locked: !post.is_locked }) }}>
                    <Lock className="mr-2 h-3.5 w-3.5" />{post.is_locked ? 'Unlock' : 'Lock'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); deletePost.mutate(post.id) }}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Title always under author */}
      <h2 className="px-4 pb-2.5 text-[15px] font-bold leading-snug tracking-tight line-clamp-2">
        {post.title}
      </h2>

      {/* Content (text-only posts) */}
      {!hasImage && post.content && (
        <p className="px-4 pb-3 text-[13px] text-muted-foreground line-clamp-3 leading-relaxed -mt-1">
          {post.content}
        </p>
      )}

      {/* Image slider */}
      {hasImage && (
        <ImageSlider urls={post.media_urls} className="mx-4 mb-3" maxHeight={200} />
      )}

      {/* Extra tags (beyond first shown in header) */}
      {post.tags.length > 1 && (
        <div className="px-4 pb-2.5 flex flex-wrap gap-1">
          {post.tags.slice(1).map((tag) => <TagChip key={tag.id} tag={tag} />)}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-4 border-t border-border/30 px-4 py-2.5">
        <button
          onClick={(e) => { e.stopPropagation(); likePost.mutate({ postId: post.id, liked: post.is_liked }) }}
          className={cn(
            'flex items-center gap-1.5 text-[13px] font-medium transition-all duration-200 active:scale-90',
            post.is_liked ? 'text-rose-500' : 'text-muted-foreground hover:text-rose-500',
          )}
        >
          <Heart className={cn('h-4 w-4 transition-all duration-200', post.is_liked && 'fill-current scale-110')} />
          {post.like_count > 0 && <span>{formatCount(post.like_count)}</span>}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onCommentClick?.() }}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <MessageCircle className="h-4 w-4" />
          {post.comment_count > 0 && <span>{post.comment_count}</span>}
        </button>

        <button
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </button>

        {post.is_locked && (
          <span className="ml-auto text-muted-foreground/40">
            <Lock className="h-3 w-3" />
          </span>
        )}
      </div>
    </article>
  )
}

// ─── Section Divider ──────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-border/40" />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">{label}</span>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  )
}

// ─── Board View ───────────────────────────────────────────────────────────────

export function BoardView({
  groupId,
  groupName,
  channelName,
  channelAvatar,
  myId,
  isAdmin,
  onMessage,
  onViewProfile,
}: {
  groupId: string
  groupName: string
  channelName?: string
  channelAvatar?: string
  myId?: string
  isAdmin: boolean
  onMessage?: (userId: string) => void
  onViewProfile?: (userId: string, userData?: { name: string; avatarUrl: string | null }) => void
}) {
  const { data: posts = [], isLoading } = useBoardPosts(groupId)
  useBoardRealtime(groupId)

  const [createOpen, setCreateOpen] = useState(false)
  const [activePost, setActivePost] = useState<BoardPost | null>(null)
  const [scrollToComments, setScrollToComments] = useState(false)

  if (activePost) {
    const live = posts.find((p) => p.id === activePost.id) ?? activePost
    return (
      <PostDetail post={live} groupId={groupId} myId={myId} isAdmin={isAdmin} onBack={() => { setActivePost(null); setScrollToComments(false) }} onMessage={onMessage} onViewProfile={onViewProfile} scrollToComments={scrollToComments} />
    )
  }

  const pinnedPosts = posts.filter((p) => p.is_pinned)
  const regularPosts = posts.filter((p) => !p.is_pinned)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Top nav */}
      <div className="relative flex items-center border-b border-border/40 px-4 py-3 shrink-0">
        {/* Left: post count */}
        <div className="w-24 flex items-start">
          {posts.length > 0 && (
            <span className="text-[11px] font-medium text-muted-foreground/60 bg-muted/60 rounded-full px-2 py-0.5">
              {posts.length} post{posts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Center: channel avatar + name */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5">
          <ChannelAvatarIcon src={channelAvatar} name={channelName ?? groupName} size="sm" />
          <div className="flex flex-col items-center leading-none">
            <span className="text-[13px] font-bold text-foreground">{channelName ?? groupName}</span>
            {channelName && (
              <span className="text-[10px] text-muted-foreground/60 font-medium mt-0.5">{groupName}</span>
            )}
          </div>
        </div>

        {/* Right: new post */}
        <div className="ml-auto">
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center justify-center h-7 w-7 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="grid grid-cols-2 gap-3 items-start">

          {/* Skeleton */}
          {isLoading && (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl border border-border/40 bg-card overflow-hidden animate-pulse">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-muted" />
                      <div className="space-y-1.5">
                        <div className="h-2.5 w-24 rounded bg-muted" />
                        <div className="h-2 w-16 rounded bg-muted" />
                      </div>
                    </div>
                    <div className="h-4 w-3/4 rounded bg-muted" />
                  </div>
                  <div className="mx-4 mb-4 h-32 rounded-xl bg-muted" />
                  <div className="px-4 pb-3 flex gap-4">
                    <div className="h-3 w-10 rounded bg-muted" />
                    <div className="h-3 w-10 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Empty state */}
          {!isLoading && posts.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center py-24 text-center animate-in fade-in duration-500">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-border/50">
                <PencilLine className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-semibold text-foreground/80">Nothing here yet</p>
              <p className="mt-1.5 text-xs text-muted-foreground max-w-[160px] leading-relaxed">Be the first to share something with the community.</p>
              <Button size="sm" className="mt-5 gap-1.5 rounded-xl" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" />Create first post
              </Button>
            </div>
          )}

          {/* Pinned */}
          {pinnedPosts.map((post, i) => (
            <PostCard key={post.id} post={post} groupId={groupId} myId={myId} isAdmin={isAdmin} onClick={() => setActivePost(post)} index={i} onMessage={onMessage} onViewProfile={onViewProfile} onCommentClick={() => { setScrollToComments(true); setActivePost(post) }} />
          ))}

          {pinnedPosts.length > 0 && regularPosts.length > 0 && (
            <div className="col-span-2">
              <SectionDivider label="Recent Activity" />
            </div>
          )}

          {/* Regular */}
          {regularPosts.map((post, i) => (
            <PostCard key={post.id} post={post} groupId={groupId} myId={myId} isAdmin={isAdmin} onClick={() => setActivePost(post)} index={pinnedPosts.length + i} onMessage={onMessage} onViewProfile={onViewProfile} onCommentClick={() => { setScrollToComments(true); setActivePost(post) }} />
          ))}

          </div>
        </div>
      </div>

      <CreatePostModal
        groupId={groupId}
        groupName={groupName}
        channelName={channelName}
        channelAvatar={channelAvatar}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        isAdmin={isAdmin}
      />
    </div>
  )
}
