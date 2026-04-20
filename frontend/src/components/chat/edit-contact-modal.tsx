'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useDeleteContact, useUpdateContact } from '@/hooks/use-user'

interface EditContactModalProps {
  contactId: string
  currentNickname: string
  onClose: () => void
}

export function EditContactModal({
  contactId,
  currentNickname,
  onClose,
}: EditContactModalProps) {
  const [nickname, setNickname] = useState(currentNickname)
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()
  const titleId = 'edit-contact-title'

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    updateContact.mutate(
      { id: contactId, nickname },
      {
        onSuccess: () => {
          toast.success('Nickname updated')
          onClose()
        },
        onError: (error: unknown) => toast.error((error as Error).message),
      },
    )
  }

  function handleDelete() {
    deleteContact.mutate(contactId, {
      onSuccess: () => {
        toast.success('Contact removed')
        onClose()
      },
      onError: (error: unknown) => toast.error((error as Error).message),
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        key="edit-contact-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[1400] bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        key="edit-contact-modal"
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
            <Pencil className="h-4 w-4 text-primary" />
            <h2 id={titleId} className="text-[14px] font-semibold text-foreground">
              Edit Contact
            </h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="edit-contact-nickname"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Nickname
            </label>
            <input
              id="edit-contact-nickname"
              required
              className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={updateContact.isPending}>
            {updateContact.isPending ? 'Saving...' : 'Save'}
          </Button>

          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={handleDelete}
            disabled={deleteContact.isPending}
          >
            {deleteContact.isPending ? 'Removing...' : 'Remove Contact'}
          </Button>
        </form>
      </motion.div>
    </AnimatePresence>
  )
}
