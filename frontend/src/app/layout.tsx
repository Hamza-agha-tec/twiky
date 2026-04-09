"use client";

import { Geist, Geist_Mono, Lora } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";
import ToastProvider from '@/context/ToastProvider';
import QueryProvider from '@/context/QueryProvider';

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
}: Readonly<{
  children: React.ReactNode;
}>) {
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
