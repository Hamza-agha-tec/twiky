'use client'

import { useState } from 'react'

import { motion } from 'framer-motion'

import { useAuth } from '@/context/AuthContext'

export default function AuthButton() {
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    if (loading) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error } = await signInWithGoogle()
      if (error) {
        throw error
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to continue with Google right now.',
      )
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={loading}
        whileTap={{ scale: 0.98 }}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-lg leading-none">G</span>
        <span>{loading ? 'Redirecting...' : 'Continue with Google'}</span>
      </motion.button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
