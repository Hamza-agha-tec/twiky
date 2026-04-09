'use client';
import { Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/context/AuthContext';
import QueryProvider from '@/context/QueryProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import ToastProvider from '@/context/ToastProvider';

const geist = Geist({
    subsets: ["latin"],
    variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const lora = Lora({
    subsets: ["latin"],
    variable: '--font-lora',
})

export default function RootLayout({
    children,
}) {
    return (
        <html lang="en" className={`${geist.variable} ${geistMono.variable} ${lora.variable}`} suppressHydrationWarning>
            <body className="antialiased font-sans">
                <AuthProvider>
                    <QueryProvider>
                        {/* <ThemeProvider> */}
                        <ToastProvider>
                            {children}
                        </ToastProvider>
                        {/* </ThemeProvider> */}
                    </QueryProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
