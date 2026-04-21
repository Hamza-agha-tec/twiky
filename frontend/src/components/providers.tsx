'use client';

import { AuthProvider } from '@/context/AuthContext';
import QueryProvider from '@/context/QueryProvider';
import ToastProvider from '@/context/ToastProvider';
import { ChatThemeProvider } from '@/context/ChatThemeContext';
import { useAuth } from '@/context/AuthContext';
import { usePresenceSocket } from '@/hooks/use-socket';

function PresenceBridge() {
  const { session } = useAuth();
  usePresenceSocket(Boolean(session));
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryProvider>
        <PresenceBridge />
        <ToastProvider>
          <ChatThemeProvider>
            {children}
          </ChatThemeProvider>
        </ToastProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
