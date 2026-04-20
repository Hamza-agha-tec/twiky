'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useAddContact } from '@/hooks/use-user'

interface AddContactModalProps {
  onClose: () => void
  onSuccess?: (contact: unknown) => void
}

export function AddContactModal({ onClose, onSuccess }: AddContactModalProps) {
  const [form, setForm] = useState({ nickname: '', phoneNumber: '+212' })
  const addContact = useAddContact()
  const titleId = 'add-contact-title'

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    addContact.mutate(form, {
      onSuccess: (contact) => {
        toast.success(`${contact.nickname ?? contact.username} added!`)
        onSuccess?.(contact)
        onClose()
      },
      onError: (error: unknown) => {
        const message = (error as Error)?.message ?? 'Failed to add contact'
        toast.error(message)
      },
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        key="add-contact-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[1400] bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        key="add-contact-modal"
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed left-1/2 top-1/2 z-[1410] w-[min(calc(100%-1.5rem),20rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-4 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h2 id={titleId} className="text-[14px] font-semibold text-foreground">
              Add Contact
            </h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="add-contact-nickname"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Nickname
            </label>
            <input
              id="add-contact-nickname"
              required
              className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Zakaria"
              value={form.nickname}
              onChange={(event) =>
                setForm((current) => ({ ...current, nickname: event.target.value }))
              }
            />
          </div>
          <div>
            <label
              htmlFor="add-contact-phone"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Phone number
            </label>
            <input
              id="add-contact-phone"
              required
              className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="+212612345678"
              value={form.phoneNumber}
              onChange={(event) =>
                setForm((current) => ({ ...current, phoneNumber: event.target.value }))
              }
            />
          </div>

          <Button type="submit" className="mt-1 w-full" disabled={addContact.isPending}>
            {addContact.isPending ? 'Adding...' : 'Add Contact'}
          </Button>
        </form>
      </motion.div>
    </AnimatePresence>
  )
}
