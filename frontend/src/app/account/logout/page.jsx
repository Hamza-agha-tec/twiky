'use client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'

export default function LogoutPage() {
   const { signOut } = useAuth()
   const router = useRouter()


  const handleSignOut = async () => {
      await signOut()
      router.push('/')
  }

  return (
    <>

      <div 
       className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-8"
      >
        <div className="w-full max-w-md">
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            {/* Header */}
            <div className="text-center mb-8">
              <h1
                className="text-3xl font-semibold text-gray-900 mb-2"
              >
                Sign Out
              </h1>
              <p className="text-gray-600 text-sm">
                Are you sure you want to sign out of your account?
              </p>
            </div>

            <div className="space-y-4">
              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                className="w-full py-3 px-6 cursor-pointer text-white font-semibold text-md transition-all duration-150 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 bg-indigo-600 rounded-lg"
              >
                Sign Out
              </button>

              {/* Cancel Button */}
              <Link
                href="/"
                className="w-full py-3 px-6 border border-gray-200 text-gray-900 font-semibold text-md hover:bg-gray-50 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-center block rounded-lg"
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
