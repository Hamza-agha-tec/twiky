import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const ThemeContext = createContext({
    theme: 'system',
    setTheme: () => { },
    resolvedTheme: 'light',
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
    const queryClient = useQueryClient();
    const [localTheme, setLocalTheme] = useState('system');
    const [resolvedTheme, setResolvedTheme] = useState('light');

    // Load from localStorage for initial flash prevention
    useEffect(() => {
        const saved = localStorage.getItem('theme');
        if (saved) setLocalTheme(saved);
    }, []);

    const { data: settings } = useQuery({
        queryKey: ['userSettings'],
        queryFn: async () => {
            if (typeof window === 'undefined') return null;
            try {
                const list = await api.entities.UserSettings.list();
                return list[0] || null;
            } catch (error) {
                console.error('Failed to fetch user settings', error);
                return null;
            }
        },
    });

    const effectiveTheme = settings?.theme || localTheme || 'system';

    const updateSettingsMutation = useMutation({
        mutationFn: async (newTheme) => {
            if (settings?.id) {
                return api.entities.UserSettings.update(settings.id, { theme: newTheme });
            } else {
                return api.entities.UserSettings.create({ theme: newTheme });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userSettings'] });
        },
    });

    const setTheme = (newTheme) => {
        setLocalTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        updateSettingsMutation.mutate(newTheme);
    };

    useEffect(() => {
        const applyTheme = () => {
            const root = window.document.documentElement;
            let themeToApply = effectiveTheme;

            if (effectiveTheme === 'system') {
                themeToApply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }

            root.classList.remove('light', 'dark');
            root.classList.add(themeToApply);
            setResolvedTheme(themeToApply);
        };

        applyTheme();

        if (effectiveTheme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = () => applyTheme();
            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        }
    }, [effectiveTheme]);

    return (
        <ThemeContext.Provider value={{ theme: effectiveTheme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}