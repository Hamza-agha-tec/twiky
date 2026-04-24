'use client'

import { useEffect, useState } from 'react'
import { Search, UserPlus, Users, X } from 'lucide-react'

import { useProfile, useSearchUsers, useSendFollowRequest, useUserFollowing } from '@/hooks/use-user'

export function AddFriendsView() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sent, setSent] = useState<Set<string>>(new Set())

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400)
    return () => clearTimeout(t)
  }, [query])

  const { data: results = [], isFetching, isError } = useSearchUsers(debouncedQuery)
  const sendFollowRequest = useSendFollowRequest()
  const { data: profile } = useProfile()
  const { data: following = [] } = useUserFollowing(profile?.id)
  const followingIds = new Set(following.map((f) => f.following_id))

  async function handleSend(userId: string) {
    try {
      await sendFollowRequest.mutateAsync(userId)
      setSent((prev) => new Set([...prev, userId]))
    } catch {}
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/10 via-background to-background px-8 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2 text-primary">
            <UserPlus className="h-5 w-5" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Add Friends</span>
          </div>
          <h1 className="mt-2 text-[28px] font-black tracking-tight text-foreground">Find people on Twiky</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">Search by username to send a follow request.</p>

          <div className="relative mt-6">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username..."
              className="w-full rounded-2xl border border-border bg-card py-3 pl-11 pr-10 text-[14px] text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {query ? (
              <button onClick={() => { setQuery(''); setDebouncedQuery('') }} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-8 py-8">
        {debouncedQuery.trim() === '' ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
              <Users className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-[15px] font-semibold text-foreground">Search for friends</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">Type a username above to find people.</p>
          </div>
        ) : isFetching ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-3 text-[13px] text-muted-foreground">Searching...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-[13px] text-destructive">Search failed. Try again.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
              <Search className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-[15px] font-semibold text-foreground">No users found</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">Try a different username.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((user) => {
              const isSelf = user.id === profile?.id
              const isAlreadyFriend = followingIds.has(user.id)
              const isSent = sent.has(user.id)
              const initial = (user.fullname ?? user.username ?? '?')[0].toUpperCase()
              return (
                <div key={user.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3 transition-all hover:border-primary/20 hover:shadow-sm">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="h-11 w-11 flex-shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground">
                      {initial}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-foreground">{user.fullname ?? user.username}</p>
                    <p className="text-[12px] text-muted-foreground">@{user.username}</p>
                  </div>
                  {isSelf ? null : isAlreadyFriend ? (
                    <span className="rounded-xl bg-muted px-3 py-2 text-[12px] font-medium text-muted-foreground">
                      Friends
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSend(user.id)}
                      disabled={isSent || sendFollowRequest.isPending}
                      className={isSent
                        ? 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold bg-muted text-muted-foreground cursor-default'
                        : 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50'}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {isSent ? 'Sent' : 'Add Friend'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
