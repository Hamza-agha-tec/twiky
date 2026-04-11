'use client'

import { Toaster } from '@/components/ui/sonner'

export default function ToastProvider({ children }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        duration={3000}
        richColors
        closeButton
      />
    </>
  )
}
