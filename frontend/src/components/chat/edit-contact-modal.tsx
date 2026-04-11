'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpdateContact, useDeleteContact } from '@/hooks/use-user';
import { toast } from 'sonner';

interface EditContactModalProps {
  contactId: string;
  currentNickname: string;
  onClose: () => void;
}

export function EditContactModal({ contactId, currentNickname, onClose }: EditContactModalProps) {
  const [nickname, setNickname] = useState(currentNickname);
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateContact.mutate({ id: contactId, nickname }, {
      onSuccess: () => {
        toast.success('Nickname updated');
        onClose();
      },
      onError: (err: unknown) => toast.error((err as Error).message),
    });
  }

  function handleDelete() {
    deleteContact.mutate(contactId, {
      onSuccess: () => {
        toast.success('Contact removed');
        onClose();
      },
      onError: (err: unknown) => toast.error((err as Error).message),
    });
  }

  return (
    <AnimatePresence>
      <motion.div
        key="edit-contact-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        key="edit-contact-modal"
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-background border border-border rounded-2xl shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">Edit Contact</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nickname</label>
            <input
              required
              className="w-full px-3 py-2 rounded-lg bg-muted text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={updateContact.isPending}>
            {updateContact.isPending ? 'Saving…' : 'Save'}
          </Button>

          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={handleDelete}
            disabled={deleteContact.isPending}
          >
            {deleteContact.isPending ? 'Removing…' : 'Remove Contact'}
          </Button>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}
