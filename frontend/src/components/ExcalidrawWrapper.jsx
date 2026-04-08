'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useTheme } from './ThemeProvider';

const ExcalidrawEditor = dynamic(
    () => import('./ExcalidrawEditor'),
    {
        ssr: false,
        loading: () => (
            <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        ),
    }
);

export default function ExcalidrawWrapper(props) {
    const { resolvedTheme } = useTheme();
    return <ExcalidrawEditor {...props} theme={resolvedTheme} />;
}
