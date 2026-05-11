import { Geist, Geist_Mono, Lora } from "next/font/google";

import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

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
  variable: "--font-lora",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${lora.variable}`}
      suppressHydrationWarning
    >
      {/* Apply persisted style theme before paint to avoid flash */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
(function(){try{
  var s=localStorage.getItem('twiky-style');
  var r=document.documentElement;
  var themes={
    black:{'--background':'oklch(0.05 0 0)','--sidebar':'oklch(0.03 0 0)','--card':'oklch(0.08 0 0)','--popover':'oklch(0.08 0 0)','--muted':'oklch(0.11 0 0)','--accent':'oklch(0.11 0 0)','--border':'oklch(1 0 0 / 7%)','--input':'oklch(1 0 0 / 9%)','--sidebar-border':'oklch(1 0 0 / 7%)','--primary':'oklch(0.72 0 0)','--primary-foreground':'oklch(0.08 0 0)','--ring':'oklch(0.72 0 0)','--sidebar-primary':'oklch(0.72 0 0)','--sidebar-primary-foreground':'oklch(0.08 0 0)'},
    glassy:{'--background':'transparent','--sidebar':'oklch(0.18 0.03 233 / 45%)','--card':'oklch(0.20 0.03 233 / 40%)','--popover':'oklch(0.22 0.04 233 / 55%)','--muted':'oklch(0.22 0.03 233 / 40%)','--accent':'oklch(0.28 0.05 233 / 50%)','--border':'oklch(0.55 0.08 233 / 18%)','--input':'oklch(0.55 0.08 233 / 15%)','--sidebar-border':'oklch(0.55 0.08 233 / 15%)','--foreground':'oklch(0.97 0 0)','--card-foreground':'oklch(0.97 0 0)','--popover-foreground':'oklch(0.97 0 0)','--muted-foreground':'oklch(0.68 0.04 233)','--accent-foreground':'oklch(0.97 0 0)','--primary':'oklch(0.51 0.17 233)','--primary-foreground':'oklch(0.98 0 0)','--ring':'oklch(0.51 0.17 233)','--sidebar-primary':'oklch(0.51 0.17 233)','--sidebar-primary-foreground':'oklch(0.98 0 0)','--sidebar-foreground':'oklch(0.97 0 0)','--sidebar-accent':'oklch(0.28 0.05 233 / 50%)','--sidebar-accent-foreground':'oklch(0.97 0 0)'}
  };
  if(s==='black'||s==='glassy'){
    r.classList.add('dark');
    r.setAttribute('data-style',s);
    var v=themes[s];
    for(var k in v)r.style.setProperty(k,v[k]);
  }
}catch(e){}})();
        ` }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
