'use client';

import { useRouter } from 'next/navigation';

export default function AuthCodeErrorPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div className="max-w-md p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-red-500 mb-4">Authentication Error</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          There was an issue during the authentication process. This could be due to:
        </p>
        <ul className="text-left list-disc pl-5 mb-6 text-gray-600 dark:text-gray-300 space-y-2">
          <li>Expired authentication link</li>
          <li>Network issues</li>
          <li>Temporary service interruption</li>
        </ul>
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4 justify-center">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Go to Home
          </button>
          <button
            onClick={() => router.refresh()}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
