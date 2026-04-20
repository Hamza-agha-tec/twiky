'use client'

import { useState } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface Task {
  id: string
  due: string
  lane: 'done' | 'in-progress' | 'next'
  owner: string
  priority: 'high' | 'medium' | 'low'
  title: string
}

interface TasksPanelProps {
  scopeKey?: string
  scopeLabel?: string
  scopeType?: 'group' | 'personal'
}

const PRIORITY_STYLES = {
  high: 'text-rose-400',
  medium: 'text-sky-400',
  low: 'text-muted-foreground',
} as const

const TASKS_BY_SCOPE: Record<string, Task[]> = {
  'personal-tasks': [
    { id: 'pt-1', title: 'Tighten profile spacing', owner: 'Y', due: 'Apr 21', lane: 'in-progress', priority: 'high' },
    { id: 'pt-2', title: 'Review showroom placeholder copy', owner: 'Y', due: 'Apr 24', lane: 'next', priority: 'medium' },
    { id: 'pt-3', title: 'Check mobile sidebar density', owner: 'Y', due: 'Done', lane: 'done', priority: 'low' },
  ],
  'twiky-studio-general': [
    { id: 'ts-1', title: 'Finalize workspace shell pass', owner: 'A', due: 'Apr 20', lane: 'in-progress', priority: 'high' },
    { id: 'ts-2', title: 'Collect channel naming rules', owner: 'Z', due: 'Apr 22', lane: 'next', priority: 'medium' },
  ],
  'design-lab-frontend-sync': [
    { id: 'dl-1', title: 'Reduce typography scale in settings', owner: 'O', due: 'Apr 21', lane: 'in-progress', priority: 'high' },
    { id: 'dl-2', title: 'Refine tab control states', owner: 'S', due: 'Apr 23', lane: 'next', priority: 'medium' },
    { id: 'dl-3', title: 'Close icon alignment issue', owner: 'N', due: 'Done', lane: 'done', priority: 'low' },
  ],
  'game-room-showroom': [
    { id: 'gr-1', title: 'Define room entry card states', owner: 'R', due: 'Apr 25', lane: 'in-progress', priority: 'medium' },
    { id: 'gr-2', title: 'List trophy slot requirements', owner: 'R', due: 'Apr 28', lane: 'next', priority: 'low' },
  ],
}

function buildScopeTasks(scopeLabel: string, scopeType: 'group' | 'personal'): Task[] {
  return [
    {
      id: `${scopeLabel}-seed-1`,
      title:
        scopeType === 'personal'
          ? 'Capture your next private action'
          : `Capture the next action for ${scopeLabel}`,
      owner: scopeType === 'personal' ? 'Y' : scopeLabel[1] ?? scopeLabel[0] ?? 'T',
      due: 'Apr 26',
      lane: 'next',
      priority: 'medium',
    },
  ]
}

function groupTasks(tasks: Task[]) {
  return {
    inProgress: tasks.filter((task) => task.lane === 'in-progress'),
    next: tasks.filter((task) => task.lane === 'next'),
    done: tasks.filter((task) => task.lane === 'done'),
  }
}

export function TasksPanel({
  scopeKey = 'personal-tasks',
  scopeLabel = 'Personal',
  scopeType = 'personal',
}: TasksPanelProps) {
  const [tasksByScope, setTasksByScope] = useState<Record<string, Task[]>>(TASKS_BY_SCOPE)
  const tasks = tasksByScope[scopeKey] ?? buildScopeTasks(scopeLabel, scopeType)
  const grouped = groupTasks(tasks)

  function updateScopeTasks(nextTasks: Task[]) {
    setTasksByScope((prev) => ({ ...prev, [scopeKey]: nextTasks }))
  }

  function toggleTask(taskId: string) {
    updateScopeTasks(
      tasks.map((task) =>
        task.id === taskId
          ? { ...task, lane: task.lane === 'done' ? 'next' : 'done', due: task.lane === 'done' ? 'Apr 26' : 'Done' }
          : task,
      ),
    )
  }

  const sections = [
    { label: 'In Progress', items: grouped.inProgress },
    { label: 'Next', items: grouped.next },
    { label: 'Done', items: grouped.done },
  ]
  const summaryItems = [
    { label: 'In progress', value: grouped.inProgress.length },
    { label: 'Next', value: grouped.next.length },
    { label: 'Done', value: grouped.done.length },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {scopeType === 'personal' ? (
        <div className="border-b border-border bg-sidebar/60 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              My tasks
            </span>
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] text-muted-foreground">
              Only visible to you
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-5 grid grid-cols-3 gap-2">
          {summaryItems.map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-background px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-[14px] font-semibold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>

        {sections.map(({ label, items }) => (
          <div key={label} className="mb-5">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {label}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold">
                {items.length}
              </span>
            </div>

            <div className="space-y-2">
              {items.map((task) => (
                <label
                  key={task.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 transition-colors hover:border-primary/20',
                    task.lane === 'done' && 'opacity-70',
                  )}
                >
                  <Checkbox
                    checked={task.lane === 'done'}
                    onCheckedChange={() => toggleTask(task.id)}
                    className="h-4.5 w-4.5 rounded-md"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-[12px] font-medium text-foreground',
                        task.lane === 'done' && 'line-through text-muted-foreground',
                      )}
                    >
                      {task.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span
                        className={cn(
                          'font-semibold uppercase tracking-[0.08em]',
                          PRIORITY_STYLES[task.priority],
                        )}
                      >
                        {task.priority}
                      </span>
                      <span>Due {task.due}</span>
                    </div>
                  </div>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                    {task.owner}
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
