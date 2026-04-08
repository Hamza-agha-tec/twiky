'use client'

import { Toaster } from 'react-hot-toast'

export default function ToastProvider({ children }) {
  return (
    <>
      {children}
      <Toaster 
        position="top-center"
        toastOptions={{
          // Default options for all toasts
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
          },
          // Default options for success/error toasts
          success: {
            duration: 4000,
            iconTheme: {
              primary: '#10B981',  // Green color for success
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#EF4444',  // Red color for error
              secondary: '#fff',
            },
          },
        }}
      />
    </>
  )
}