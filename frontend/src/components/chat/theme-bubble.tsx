'use client';

import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeBubble() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div className="w-14 h-7" />;

  const isDark = resolvedTheme === 'dark';

  return (
    <motion.button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="relative flex items-center w-14 h-7 rounded-full bg-muted border border-border p-0.5 cursor-pointer overflow-hidden flex-shrink-0"
      whileTap={{ scale: 0.93 }}
    >
      {/* Track icons */}
      <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
        <Sun className="h-3.5 w-3.5 text-amber-400" />
        <Moon className="h-3.5 w-3.5 text-indigo-400" />
      </div>

      {/* Sliding thumb */}
      <motion.div
        className="relative z-10 h-5 w-5 rounded-full bg-background shadow-sm border border-border flex items-center justify-center"
        animate={{ x: isDark ? 28 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      >
        <motion.div
          animate={{ rotate: isDark ? 360 : 0 }}
          transition={{ duration: 0.4 }}
        >
          {isDark
            ? <Moon className="h-3 w-3 text-indigo-400" />
            : <Sun className="h-3 w-3 text-amber-400" />
          }
        </motion.div>
      </motion.div>
    </motion.button>
  );
}
