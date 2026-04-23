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

const OVERRIDDEN_VARS = [
  '--primary', '--primary-foreground',
  '--ring',
  '--sidebar-primary', '--sidebar-primary-foreground', '--sidebar-ring',
  '--accent', '--accent-foreground',
  '--sidebar-accent', '--sidebar-accent-foreground',
  '--muted',
  '--border',
];

/** Blend theme color into a neutral base (opaque result, safe for all surfaces). */
function blendColor(r: number, g: number, b: number, base: number, alpha: number) {
  return `rgb(${Math.round(base + (r - base) * alpha)},${Math.round(base + (g - base) * alpha)},${Math.round(base + (b - base) * alpha)})`;
}

function applyThemeVars(v: ChatThemeVariant, isDark: boolean) {
  const el = document.documentElement;
  if (!v.own) {
    OVERRIDDEN_VARS.forEach((p) => el.style.removeProperty(p));
    return;
  }

  const r = parseInt(v.own.slice(1, 3), 16);
  const g = parseInt(v.own.slice(3, 5), 16);
  const b = parseInt(v.own.slice(5, 7), 16);
  const rgba = (a: number) => `rgba(${r},${g},${b},${a})`;

  // Approximate neutral base values for light/dark mode
  const bgBase     = isDark ? 24  : 255; // --background
  const mutedBase  = isDark ? 55  : 245; // --muted

  // Primary & ring
  el.style.setProperty('--primary',                    v.own);
  el.style.setProperty('--primary-foreground',         v.ownText);
  el.style.setProperty('--ring',                       v.own);

  // Sidebar primary
  el.style.setProperty('--sidebar-primary',            v.own);
  el.style.setProperty('--sidebar-primary-foreground', v.ownText);
  el.style.setProperty('--sidebar-ring',               v.own);

  // Accent — hover / active states
  el.style.setProperty('--accent',                     rgba(isDark ? 0.18 : 0.14));
  el.style.setProperty('--accent-foreground',          v.own);
  el.style.setProperty('--sidebar-accent',             rgba(isDark ? 0.18 : 0.14));
  el.style.setProperty('--sidebar-accent-foreground',  v.own);

  // Muted — input backgrounds, skeletons, badges (opaque blend)
  el.style.setProperty('--muted',   blendColor(r, g, b, mutedBase,   isDark ? 0.14 : 0.16));

  // Border — subtle themed dividers
  el.style.setProperty('--border',  rgba(isDark ? 0.14 : 0.18));
}

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

  // Inject / remove CSS vars whenever theme or dark/light mode changes
  useEffect(() => {
    applyThemeVars(resolved, resolvedTheme === 'dark');
  }, [resolved, resolvedTheme]);

  return (
    <ChatThemeContext.Provider value={{ theme, resolved, themeId, setTheme }}>
      {children}
    </ChatThemeContext.Provider>
  );
}

export function useChatThemeContext() {
  return useContext(ChatThemeContext);
}
