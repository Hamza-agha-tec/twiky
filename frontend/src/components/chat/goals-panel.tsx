'use client'

import { useMemo, useState } from 'react'
import { CalendarRange, Flag, Plus, Target, TimerReset } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

interface Goal {
  due: string
  id: string
  lane: string
  priority: 'high' | 'low' | 'medium'
  progress: number
  start: string
  summary: string
  title: string
}

interface GoalsPanelProps {
  scopeKey?: string
  scopeLabel?: string
  scopeType?: 'group' | 'personal'
}

const PRIORITY_STYLES = {
  high: { bg: 'rgba(240,112,112,0.12)', color: '#f07070' },
  medium: { bg: 'rgba(91,164,245,0.12)', color: '#5ba4f5' },
  low: { bg: 'rgba(79,209,160,0.12)', color: '#4fd1a0' },
} as const

const GOALS_BY_SCOPE: Record<string, Goal[]> = {
  'personal-goals': [
    {
      id: 'pg-1',
      title: 'Ship the tighter chat shell',
      summary: 'Reduce wasted space and make personal surfaces feel clearly separate from shared channels.',
      progress: 78,
      start: '2026-04-16',
      due: '2026-04-22',
      priority: 'high',
      lane: 'Product polish',
    },
    {
      id: 'pg-2',
      title: 'Prepare showroom follow-up',
      summary: 'Define the next slice for room entry states, trophies, and future interactions.',
      progress: 36,
      start: '2026-04-18',
      due: '2026-04-28',
      priority: 'medium',
      lane: 'Game systems',
    },
  ],
  'twiky-studio-general': [
    {
      id: 'tsg-1',
      title: 'Lock the workspace navigation',
      summary: 'Personal tools, direct messages, and channels must read as three separate surfaces.',
      progress: 68,
      start: '2026-04-14',
      due: '2026-04-23',
      priority: 'high',
      lane: 'Navigation',
    },
  ],
  'design-lab-ui-critique': [
    {
      id: 'dlg-1',
      title: 'Lower the global type scale',
      summary: 'Profile, settings, and chat sidebars should feel more compact and professional.',
      progress: 59,
      start: '2026-04-17',
      due: '2026-04-24',
      priority: 'high',
      lane: 'Typography',
    },
    {
      id: 'dlg-2',
      title: 'Refine channel tab treatment',
      summary: 'Channel feed tabs should feel intentional and easier to scan.',
      progress: 41,
      start: '2026-04-18',
      due: '2026-04-26',
      priority: 'medium',
      lane: 'Controls',
    },
  ],
  'game-room-showroom': [
    {
      id: 'grs-1',
      title: 'Define the showroom roadmap',
      summary: 'Outline how profile rooms, trophies, and featured items will land in future iterations.',
      progress: 28,
      start: '2026-04-18',
      due: '2026-04-30',
      priority: 'medium',
      lane: 'Showroom',
    },
  ],
}

const DEFAULT_FORM = {
  title: '',
  summary: '',
  start: new Date().toISOString().slice(0, 10),
  due: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
  priority: 'medium' as Goal['priority'],
}

function buildScopeGoals(scopeLabel: string, scopeType: 'group' | 'personal'): Goal[] {
  return [
    {
      id: `${scopeLabel}-seed-1`,
      title: scopeType === 'personal' ? 'Set your next private goal' : `Set the next goal for ${scopeLabel}`,
      summary:
        scopeType === 'personal'
          ? 'This goal belongs only to you and stays outside shared groups.'
          : `This goal belongs only to ${scopeLabel} and should stay scoped to this group.`,
      progress: 12,
      start: new Date().toISOString().slice(0, 10),
      due: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
      priority: 'low',
      lane: scopeType === 'personal' ? 'Personal planning' : 'Group planning',
    },
  ]
}

export function GoalsPanel({
  scopeKey = 'personal-goals',
  scopeLabel = 'Personal',
  scopeType = 'personal',
}: GoalsPanelProps) {
  const [view, setView] = useState<'list' | 'timeline'>('list')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [goalsByScope, setGoalsByScope] = useState<Record<string, Goal[]>>(GOALS_BY_SCOPE)

  const goals = goalsByScope[scopeKey] ?? buildScopeGoals(scopeLabel, scopeType)
  const sortedGoals = useMemo(
    () => [...goals].sort((a, b) => a.due.localeCompare(b.due)),
    [goals],
  )
  const averageProgress = goals.length
    ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length)
    : 0
  const nextDue = sortedGoals[0]

  function updateScopeGoals(nextGoals: Goal[]) {
    setGoalsByScope((prev) => ({ ...prev, [scopeKey]: nextGoals }))
  }

  function saveGoal() {
    const nextTitle = form.title.trim()
    if (!nextTitle) return

    updateScopeGoals([
      {
        id: `${scopeKey}-${Date.now()}`,
        title: nextTitle,
        summary: form.summary.trim() || 'No summary yet.',
        progress: 0,
        start: form.start,
        due: form.due,
        priority: form.priority,
        lane: scopeType === 'personal' ? 'Personal planning' : `${scopeLabel} planning`,
      },
      ...goals,
    ])
    setForm({ ...DEFAULT_FORM })
    setDialogOpen(false)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {scopeType === 'personal' ? (
        <div className="border-b border-border bg-sidebar/60 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              My goals
            </span>
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] text-muted-foreground">
              Visible only to you
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => {
              if (value === 'list' || value === 'timeline') setView(value)
            }}
            className="gap-1 rounded-2xl border border-border bg-background p-1"
          >
            <ToggleGroupItem
              value="list"
              className="h-8 rounded-xl px-3 text-[11px] font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              List
            </ToggleGroupItem>
            <ToggleGroupItem
              value="timeline"
              className="h-8 rounded-xl px-3 text-[11px] font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Timeline
            </ToggleGroupItem>
          </ToggleGroup>

          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="h-8 rounded-xl px-3 text-[11px] font-semibold sm:ml-auto"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New goal
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Active goals
            </p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">{goals.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Average progress
            </p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">
              {averageProgress}%
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Next due
            </p>
            <p className="mt-1 truncate text-[14px] font-semibold text-foreground">
              {nextDue ? nextDue.due : 'No due date'}
            </p>
          </div>
        </div>

        {view === 'list' ? (
          <div className="space-y-2.5">
            {goals.map((goal) => {
              const priorityStyle = PRIORITY_STYLES[goal.priority]

              return (
                <div
                  key={goal.id}
                  className="rounded-2xl border border-border bg-card p-3.5 shadow-none"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Target className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[12px] font-semibold text-foreground">
                          {goal.title}
                        </p>
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]"
                          style={priorityStyle}
                        >
                          {goal.priority}
                        </span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {goal.lane}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                        {goal.summary}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Progress</span>
                      <span className="font-semibold text-foreground">{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarRange className="h-3.5 w-3.5" />
                      {goal.start}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <TimerReset className="h-3.5 w-3.5" />
                      {goal.due}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="relative ml-3 border-l border-border pl-5">
            {sortedGoals.map((goal) => {
              const priorityStyle = PRIORITY_STYLES[goal.priority]

              return (
                <div key={goal.id} className="relative pb-4">
                  <span
                    className={cn(
                      'absolute -left-[28px] top-2 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary',
                      goal.priority === 'high' && 'bg-rose-400',
                      goal.priority === 'medium' && 'bg-sky-400',
                      goal.priority === 'low' && 'bg-emerald-400',
                    )}
                  />

                  <div className="rounded-2xl border border-border bg-card p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[12px] font-semibold text-foreground">
                            {goal.title}
                          </p>
                          <span
                            className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]"
                            style={priorityStyle}
                          >
                            {goal.priority}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                          {goal.summary}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-right">
                        <p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                          Due
                        </p>
                        <p className="text-[11px] font-semibold text-foreground">
                          {goal.due}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Flag className="h-3.5 w-3.5" />
                        {goal.lane}
                      </span>
                      <span>
                        {goal.start} to {goal.due}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Completion</span>
                        <span className="font-semibold text-foreground">{goal.progress}%</span>
                      </div>
                      <Progress value={goal.progress} className="h-2" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">New goal</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Title</Label>
              <Input
                placeholder="Ship the compact workspace shell"
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                className="h-10 rounded-xl text-[12px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px]">Summary</Label>
              <Textarea
                placeholder="What does success look like?"
                value={form.summary}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, summary: event.target.value }))
                }
                className="min-h-24 rounded-xl text-[12px] leading-5"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Start</Label>
                <Input
                  type="date"
                  value={form.start}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, start: event.target.value }))
                  }
                  className="h-10 rounded-xl text-[12px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Due</Label>
                <Input
                  type="date"
                  value={form.due}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, due: event.target.value }))
                  }
                  className="h-10 rounded-xl text-[12px]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px]">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    priority: value as Goal['priority'],
                  }))
                }
              >
                <SelectTrigger className="h-10 rounded-xl text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveGoal} disabled={!form.title.trim()}>
              Save goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
