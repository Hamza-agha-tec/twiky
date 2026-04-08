import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { Button } from './ui/button';

export default function ThemeToggleButton({ variant = 'ghost', size = 'icon' }) {
    const { theme, setTheme } = useTheme();

    return (
        <Button
            variant={variant}
            size={size}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className={'flex items-center cursor-pointer rounded-lg text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground'}
        >
            {theme === 'light' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
    );
}