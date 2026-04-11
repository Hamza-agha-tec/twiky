'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAddContact } from '@/hooks/use-user';
import { toast } from 'sonner';

interface AddContactModalProps {
  onClose: () => void;
  onSuccess?: (contact: unknown) => void;
}

export function AddContactModal({ onClose, onSuccess }: AddContactModalProps) {
  const [form, setForm] = useState({ nickname: '', phoneNumber: '+212' });
  const addContact = useAddContact();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addContact.mutate(form, {
      onSuccess: (contact) => {
        toast.success(`${contact.nickname ?? contact.username} added!`);
        onSuccess?.(contact);
        onClose();
      },
      onError: (err: unknown) => {
        const msg = (err as Error)?.message ?? 'Failed to add contact';
        toast.error(msg);
      },
    });
  }

  return (
    <AnimatePresence>
      <motion.div
        key="add-contact-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        key="add-contact-modal"
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-background border border-border rounded-2xl shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">Add Contact</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nickname</label>
            <input
              required
              className="w-full px-3 py-2 rounded-lg bg-muted text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Zakaria"
              value={form.nickname}
              onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone number</label>
            <input
              required
              className="w-full px-3 py-2 rounded-lg bg-muted text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="+212612345678"
              value={form.phoneNumber}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
            />
          </div>

          <Button type="submit" className="w-full mt-1" disabled={addContact.isPending}>
            {addContact.isPending ? 'Adding…' : 'Add Contact'}
          </Button>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}
