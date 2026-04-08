// src/app/account/update-password/page.jsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ text: '', isError: false });
  const [loading, setLoading] = useState(false);
  const { updatePassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if this is a password reset flow
    if (searchParams.get('type') === 'recovery') {
      // The user is coming from a password reset email
      // You might want to verify the token here
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match', isError: true });
      return;
    }

    setLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) throw error;
      setMessage({ text: 'Password updated successfully!', isError: false });
      // Redirect to login or home page after a short delay
      setTimeout(() => router.push('/'), 2000);
    } catch (error) {
      setMessage({ text: error.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Update your password
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {message.text && (
            <div className={`p-4 rounded-md ${message.isError ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
              {message.text}
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
            <div className="space-y-2">
                <label className="block text-md font-semibold text-black">
                  New Password
                </label>
                <input
                  id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded border border-[#E0E0E0] bg-white text-[#0D0D0D] text-black placeholder-[#999999] focus:border-[#8B70F6] focus:outline-none focus:ring-2 focus:ring-[#8B70F6] focus:ring-opacity-20 transition-colors"
                />
              </div>

            <div className="space-y-2">
                <label className="block text-md font-semibold text-black">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded border border-[#E0E0E0] bg-white text-[#0D0D0D] text-black placeholder-[#999999] focus:border-[#8B70F6] focus:outline-none focus:ring-2 focus:ring-[#8B70F6] focus:ring-opacity-20 transition-colors"
                />
              </div>
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
                {loading ? 'Updating...' : 'Update password'}
              </button>
          </div>
        </form>
      </div>
    </div>
  );
}