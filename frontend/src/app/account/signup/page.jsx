'use client'

import { useState, useId, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/utils/supabase/client'
import AuthButton from '@/components/AuthButton'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } }
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 }
}

export default function SignUpPage() {
  const nameId = useId()
  const emailId = useId()
  const passwordId = useId()

  useEffect(() => {
    document.title = 'Sign Up - DigiPS';
  }, []);

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const { signUp, linkEmailPassword } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const onSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { error } = await linkEmailPassword(email.trim(), password)
        if (error) throw error
      } else {
        const { error } = await signUp(email.trim(), password, name)
        if (error) throw error
      }

      router.replace('/profile')
    } catch (err) {
      setError(err?.message || 'Unable to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50/40 flex items-center justify-center px-6">
      <motion.div
        className="w-full max-w-md"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div
          className="bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-gray-200 p-8"
          variants={item}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-gray-900">Create account</h1>
            <p className="text-sm text-gray-600 mt-1">
              Get started with your digital products
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            {/* Name */}
            <motion.div variants={item}>
              <label htmlFor={nameId} className="block text-sm font-medium text-gray-700">
                Full name
              </label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id={nameId}
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                />
              </div>
            </motion.div>

            {/* Email */}
            <motion.div variants={item}>
              <label htmlFor={emailId} className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id={emailId}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                />
              </div>
            </motion.div>

            {/* Password */}
            <motion.div variants={item}>
              <label htmlFor={passwordId} className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id={passwordId}
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
                />
              </div>
            </motion.div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-xl border border-red-200 bg-red-50 p-3"
                >
                  <p className="text-sm text-red-700">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              variants={item}
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </motion.button>

            {/* Google Auth */}
            <motion.div variants={item}>
              <AuthButton />
            </motion.div>

            {/* Footer */}
            <motion.p variants={item} className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/account/signin" className="font-semibold text-indigo-600 hover:text-indigo-500">
                Sign in
              </Link>
            </motion.p>
          </form>
        </motion.div>
      </motion.div>
    </div>
  )
}
