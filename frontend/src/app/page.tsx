'use client';

import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const router = useRouter();

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-sky-500/30 selection:text-sky-200 overflow-hidden relative">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-sky-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute top-[40%] left-[50%] translate-x-[-50%] w-[800px] h-[400px] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none" />

      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-zinc-950/70 backdrop-blur-xl border-b border-zinc-800/50 py-4" : "bg-transparent py-6"
        }`}
      >
        <div className="container mx-auto px-6 max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Twiky</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <a href="#download" className="hover:text-white transition-colors">Download</a>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <button
                onClick={() => router.push('/chat')}
                className="px-5 py-2.5 rounded-full bg-white text-zinc-950 font-semibold text-sm hover:bg-zinc-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                Open Twiky Web
              </button>
            ) : (
              <>
                <Link href="/account/signin" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
                  Log in
                </Link>
                <Link
                  href="/account/signup"
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white font-medium text-sm hover:shadow-[0_0_20px_rgba(14,165,233,0.4)] transition-all hover:-translate-y-0.5"
                >
                  Start Messaging
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300 text-xs font-semibold mb-8 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            Twiky Web app is now live
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 mb-8 leading-tight">
            The next generation of <br className="hidden md:block"/> instant messaging.
          </h1>
          
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Lightning fast, infinitely scalable, and relentlessly secure. Connect with friends and communities through a beautifully crafted, cloud-synced chat experience.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => router.push(isAuthenticated ? '/chat' : '/account/signup')}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-zinc-950 font-bold text-lg hover:bg-zinc-100 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] hover:-translate-y-1"
            >
              Open in Browser
            </button>
            <button className="w-full sm:w-auto px-8 py-4 rounded-full bg-zinc-900 border border-zinc-800 text-white font-medium text-lg hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2">
              <svg className="w-5 h-5 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM11 17H9v-2h2v2zm0-4H9V7h2v6zm4-4h-2V7h2v2zm0 8h-2v-6h2v6z" opacity="0.2"/>
                <path d="M17 19H7v-2h10v2zm0-4H7V7h2v6h6V7h2v8z"/>
              </svg>
              Download App
            </button>
          </div>
        </div>

        {/* Dashboard Preview Graphic */}
        <div className="mt-24 container mx-auto max-w-5xl relative">
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10 bottom-[-20%]"></div>
          <div className="relative rounded-2xl md:rounded-[2rem] border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-2xl p-4 md:p-6 overflow-hidden">
             
             {/* Mock Chat UI */}
             <div className="grid grid-cols-1 md:grid-cols-4 gap-0 border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
                {/* Sidebar */}
                <div className="md:col-span-1 border-r border-zinc-800 h-96 flex flex-col hidden sm:flex">
                  <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                     <div className="w-6 h-4 bg-zinc-800 rounded-full"></div>
                     <div className="h-6 bg-zinc-800 rounded-full w-24"></div>
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="p-3 bg-sky-900/40 rounded-lg flex gap-3 items-center">
                       <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-500/50"></div>
                       <div className="flex-1">
                         <div className="h-3 bg-zinc-200 rounded w-16 mb-2"></div>
                         <div className="h-2 bg-sky-400 rounded w-24"></div>
                       </div>
                    </div>
                    <div className="p-3 hover:bg-zinc-900 transition-colors rounded-lg flex gap-3 items-center">
                       <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
                       <div className="flex-1">
                         <div className="h-3 bg-zinc-400 rounded w-20 mb-2"></div>
                         <div className="h-2 bg-zinc-600 rounded w-32"></div>
                       </div>
                    </div>
                    <div className="p-3 hover:bg-zinc-900 transition-colors rounded-lg flex gap-3 items-center">
                       <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/50"></div>
                       <div className="flex-1">
                         <div className="h-3 bg-zinc-400 rounded w-24 mb-2"></div>
                         <div className="h-2 bg-zinc-600 rounded w-16"></div>
                       </div>
                    </div>
                  </div>
                </div>
                {/* Chat Area */}
                <div className="md:col-span-3 h-96 flex flex-col relative bg-zinc-950/80">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
                  <div className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-950/90 backdrop-blur z-10">
                    <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-500/50"></div>
                    <div>
                      <div className="h-4 bg-zinc-200 rounded w-24 mb-1.5"></div>
                      <div className="h-2 bg-sky-400/80 rounded w-16"></div>
                    </div>
                  </div>
                  <div className="flex-1 p-6 flex flex-col gap-4 justify-end overflow-hidden z-10">
                    <div className="self-start max-w-[70%]">
                      <div className="bg-zinc-800 p-3 rounded-2xl rounded-tl-none border border-zinc-700/50">
                        <div className="h-3 bg-zinc-300 rounded w-48 mb-2"></div>
                        <div className="h-3 bg-zinc-300 rounded w-32"></div>
                      </div>
                    </div>
                    <div className="self-end max-w-[70%]">
                      <div className="bg-sky-600 p-3 rounded-2xl rounded-tr-none shadow-lg shadow-sky-900/20">
                        <div className="h-3 bg-sky-100 rounded w-56 mb-2"></div>
                        <div className="h-3 bg-sky-100 rounded w-40 mb-2"></div>
                        <div className="flex items-center gap-2 justify-end">
                           <div className="h-2 bg-sky-300 rounded w-8"></div>
                           <svg className="w-3 h-3 text-sky-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-zinc-950/90 backdrop-blur z-10 border-t border-zinc-800">
                    <div className="h-10 bg-zinc-900 border border-zinc-800 rounded-full w-full flex items-center px-4 justify-between">
                      <div className="h-3 bg-zinc-600 rounded w-32"></div>
                      <div className="w-6 h-6 rounded-full bg-sky-500/80"></div>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-24 px-6 relative z-10 bg-zinc-950">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">A new era of <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">messaging.</span></h2>
            <p className="text-zinc-400 max-w-2xl mx-auto text-lg">Send anything, anywhere, instantly. Twiky brings the power of modern cloud infrastructure to your conversations.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[320px]">
            {/* Feature 1: Channels & Groups */}
            <div className="md:col-span-2 rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-8 flex flex-col justify-between group hover:border-sky-500/50 transition-colors overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-[80px] group-hover:bg-sky-500/20 transition-colors"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-full bg-sky-500/20 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold mb-2">Massive Groups & Channels</h3>
                <p className="text-zinc-400 max-w-md">Create channels to broadcast messages to unlimited audiences or spin up group chats containing thousands of members securely and lag-free.</p>
              </div>
              <div className="mt-8 flex gap-3 opacity-50 group-hover:opacity-100 transition-opacity translate-y-4 group-hover:translate-y-0 duration-500">
                <div className="px-5 py-2.5 bg-zinc-800 rounded-2xl rounded-tl-none text-xs flex gap-2 items-center">
                  <span className="font-bold text-sky-400">@david:</span> Is the event at 8?
                </div>
                <div className="px-5 py-2.5 bg-sky-600 rounded-2xl rounded-tr-none text-xs text-white">Yes, see you there!</div>
              </div>
            </div>

            {/* Feature 2: Lightning Fast */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-8 flex flex-col justify-between group hover:border-indigo-500/50 transition-colors relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[60px] group-hover:bg-indigo-500/20 transition-colors"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold mb-2">Lightning Fast</h3>
                <p className="text-zinc-400">Messages are delivered faster than any other application thanks to our distributed global cloud architecture.</p>
              </div>
              <div className="mt-6 flex items-center gap-4">
                 <div className="w-full h-8 bg-zinc-800/80 rounded-full flex items-center px-1 overflow-hidden">
                    <div className="h-6 w-6 rounded-full bg-indigo-500 text-white flex items-center justify-center transform group-hover:translate-x-[200px] transition-transform duration-700 ease-in-out">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0l-7-7m7 7l-7 7" /></svg>
                    </div>
                 </div>
              </div>
            </div>

            {/* Feature 3: Bank Grade Security */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-8 flex flex-col justify-between group hover:border-emerald-500/50 transition-colors relative overflow-hidden">
               <div className="absolute top-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-[60px] group-hover:bg-emerald-500/20 transition-colors"></div>
               <div className="relative z-10">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold mb-2">Relentlessly Secure</h3>
                <p className="text-zinc-400">Heavily encrypted data transfer. Twiky keeps your conversations safe from prying eyes with end-to-end encryption protocols.</p>
              </div>
            </div>

            {/* Feature 4: Device Sync */}
            <div className="md:col-span-2 rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-8 flex justify-between items-center group hover:border-blue-500/50 transition-colors relative overflow-hidden">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-32 bg-blue-500/5 rotate-12 blur-[40px] group-hover:bg-blue-500/10 transition-colors"></div>
               <div className="relative z-10 max-w-md">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold mb-2">Synced seamlessly. Always.</h3>
                <p className="text-zinc-400">Access your messages simultaneously from multiple phones, tablets, or computers. Twiky natively syncs your history securely into the cloud.</p>
              </div>
              <div className="hidden md:flex gap-4 items-center h-full relative z-10 justify-end">
                <div className="w-16 h-24 border-2 border-zinc-700 rounded-xl relative overflow-hidden group-hover:border-sky-500/50 transition-colors">
                  <div className="absolute bottom-0 w-full h-0 bg-sky-500/30 group-hover:h-full transition-all duration-1000"></div>
                </div>
                <div className="w-24 h-16 border-2 border-zinc-700 rounded-xl relative overflow-hidden group-hover:border-sky-500/50 transition-colors delay-100">
                  <div className="absolute bottom-0 w-full h-0 bg-sky-500/30 group-hover:h-full transition-all duration-1000 delay-100"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 relative z-10 bg-gradient-to-t from-sky-900/10 to-transparent">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">Stop texting. Start communicating.</h2>
          <button 
            onClick={() => router.push(isAuthenticated ? '/dashboard' : '/account/signup')}
            className="px-10 py-5 rounded-full bg-sky-500 text-white font-bold text-lg hover:bg-sky-400 ring-4 ring-sky-500/20 hover:ring-sky-500/40 transition-all hover:scale-105 shadow-[0_0_40px_rgba(14,165,233,0.3)]"
          >
            Join Twiky Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950 py-12 relative z-10">
        <div className="container mx-auto px-6 max-w-6xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </div>
            <span className="font-bold text-lg text-white">Twiky</span>
          </div>
          <div className="flex gap-8 text-sm text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">API</a>
            <a href="#" className="hover:text-white transition-colors">Security</a>
          </div>
          <p className="text-zinc-600 text-sm">© {new Date().getFullYear()} Twiky Messenger. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
