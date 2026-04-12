'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { CHAT_THEMES, ChatTheme, ChatThemeVariant } from '@/hooks/use-chat-theme';
import { useTheme } from '@/components/theme-provider';

const KEY = 'chat-bubble-theme';

interface ChatThemeCtx {
  theme: ChatTheme;
  resolved: ChatThemeVariant;
  themeId: string;
  setTheme: (id: string) => void;
}

const empty: ChatThemeVariant = { own: '', ownText: '', other: '', otherText: '', bg: '' };

const ChatThemeContext = createContext<ChatThemeCtx>({
  theme: CHAT_THEMES[0],
  resolved: empty,
  themeId: 'default',
  setTheme: () => {},
});

export function ChatThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState('default');
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved) setThemeId(saved);
  }, []);

  function setTheme(id: string) {
    setThemeId(id);
    localStorage.setItem(KEY, id);
  }

  const theme = CHAT_THEMES.find((t) => t.id === themeId) ?? CHAT_THEMES[0];
  const resolved = themeId === 'default' ? empty : (resolvedTheme === 'dark' ? theme.dark : theme.light);

  return (
    <ChatThemeContext.Provider value={{ theme, resolved, themeId, setTheme }}>
      {children}
    </ChatThemeContext.Provider>
  );
}

export function useChatThemeContext() {
  return useContext(ChatThemeContext);
}
