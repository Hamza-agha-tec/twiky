'use client';

import { AuthProvider } from '@/context/AuthContext';
import QueryProvider from '@/context/QueryProvider';
import ToastProvider from '@/context/ToastProvider';
import { ChatThemeProvider } from '@/context/ChatThemeContext';
import { DynamicIslandProvider } from '@/context/DynamicIslandContext';
import { DynamicIsland } from '@/components/dynamic-island/DynamicIsland';
import { GlobalNotificationBridge } from '@/components/dynamic-island/GlobalNotificationBridge';
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
        <DynamicIslandProvider>
          <PresenceBridge />
          <GlobalNotificationBridge />
          <DynamicIsland />
          <ToastProvider>
            <ChatThemeProvider>
              {children}
            </ChatThemeProvider>
          </ToastProvider>
        </DynamicIslandProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
