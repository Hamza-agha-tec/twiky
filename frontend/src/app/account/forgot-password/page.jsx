// src/app/account/forgot-password/page.jsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) throw error;
      setMessage('Check your email for the password reset link');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset your password
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {message && (
            <div className={`p-4 rounded-md ${message.includes('Check your email') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message}
            </div>
          )}
          <div className="space-y-2">
            <label className="block text-md font-semibold text-black">
              Email address
            </label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded border border-[#E0E0E0] bg-white text-[#0D0D0D] text-black placeholder-[#999999] focus:border-[#8B70F6] focus:outline-none focus:ring-2 focus:ring-[#8B70F6] focus:ring-opacity-20 transition-colors"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer py-3 px-6 rounded text-white font-semibold text-md transition-all duration-150 hover:bg-[#7E64F2] dark:hover:bg-[#8B70F6] focus:outline-none focus:ring-2 focus:ring-[#8B70F6] focus:ring-offset-2 disabled:opacity-50"
              style={{
                background: "linear-gradient(to top, #8B70F6, #9D7DFF)",
              }}
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}