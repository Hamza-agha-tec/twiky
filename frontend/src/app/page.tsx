'use client';

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] as const },
});

const inView = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.45, delay, ease: [0.25, 0.1, 0.25, 1] as const },
});

const WAVE = [30, 55, 40, 80, 60, 45, 90, 50, 70, 35, 75, 55, 85, 45, 65, 40, 75, 50, 60, 35];

const MESSAGES = [
  { id: 1, isOwn: false, type: 'text', content: "Hey! Finally switched to Twiky 👋", showAt: 1.0 },
  { id: 2, isOwn: true, type: 'text', content: "You're going to love it ⚡", showAt: 2.2 },
  { id: 3, isOwn: false, type: 'image', content: null, showAt: 3.8 },
  { id: 4, isOwn: true, type: 'text', content: "Photo looks stunning 😍", showAt: 4.8 },
  { id: 5, isOwn: false, type: 'voice', content: '0:32', showAt: 6.2 },
  { id: 6, isOwn: true, type: 'text', content: "Crystal clear quality 🎙️", showAt: 7.2 },
  { id: 7, isOwn: false, type: 'text', content: "And everything's encrypted 🔒", showAt: 8.2 },
];

const CALLOUTS = [
  { id: 'speed', range: [0, 3.2], tag: 'Instant', title: 'Messages arrive the moment you send.', desc: 'Sub-millisecond delivery over a globally distributed network. No delays, ever.' },
  { id: 'media', range: [3.2, 5.5], tag: 'Media', title: 'Share anything, beautifully.', desc: 'Images and files render inline at full quality — no compression, no quality loss.' },
  { id: 'voice', range: [5.5, 7.8], tag: 'Voice', title: 'Voice notes, elevated.', desc: 'Send waveform voice messages with noise cancellation built in.' },
  { id: 'secure', range: [7.8, 9], tag: 'Security', title: 'Zero-knowledge. Always.', desc: 'End-to-end encrypted by default. Not even we can read what you send.' },
];

function TypingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 6 }}
      transition={{ duration: 0.18 }}
      className="flex items-end gap-2 mb-1"
    >
      <div className="h-5 w-5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex-shrink-0" />
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex gap-1 items-center">
        {[0, 0.18, 0.36].map((d, i) => (
          <motion.div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[#555]"
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: d }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function ChatMsg({ msg, step }: { msg: typeof MESSAGES[0]; step: number }) {
  const visible = step >= msg.showAt;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={msg.isOwn ? { opacity: 0, x: 20, scale: 0.92 } : { opacity: 0, x: -20, scale: 0.92 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className={`flex items-end gap-2 ${msg.isOwn ? 'justify-end' : 'justify-start'} mb-1`}
        >
          {!msg.isOwn && (
            <div className="h-5 w-5 rounded-full bg-[#0ea5e915] border border-[#0ea5e930] flex-shrink-0" />
          )}

          {msg.type === 'text' && (
            <div className={`max-w-[72%] rounded-2xl px-3.5 py-2 text-[12px] leading-relaxed ${
              msg.isOwn
                ? 'bg-white text-black rounded-br-sm'
                : 'bg-[#1a1a1a] text-white border border-[#2a2a2a] rounded-bl-sm'
            }`}>
              {msg.content}
              {msg.isOwn && (
                <span className="ml-2 text-[10px] text-[#888]">
                  {step >= msg.showAt + 1 ? '✓✓' : '✓'}
                </span>
              )}
            </div>
          )}

          {msg.type === 'image' && (
            <div className="w-36 h-24 rounded-xl overflow-hidden border border-[#2a2a2a] relative bg-[#111]">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0ea5e920] via-[#6366f115] to-[#10b98120]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-[#0ea5e930] to-[#6366f125]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              />
            </div>
          )}

          {msg.type === 'voice' && (
            <div className="flex items-center gap-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl rounded-bl-sm px-3 py-2.5 min-w-[160px]">
              <div className="h-6 w-6 rounded-full bg-[#0ea5e9] flex items-center justify-center flex-shrink-0">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
              </div>
              <div className="flex items-center gap-[2px] h-5 flex-1">
                {WAVE.map((h, i) => (
                  <motion.div
                    key={i}
                    className="w-[2px] rounded-full bg-[#0ea5e9]"
                    style={{ height: `${Math.max(15, h * 0.55)}%` }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: i * 0.015, duration: 0.2 }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-[#555]">{msg.content}</span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ScrollDemo() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  const rawStep = useTransform(scrollYProgress, [0, 1], [0, 9]);
  const [step, setStep] = useState(0);
  useMotionValueEvent(rawStep, 'change', (v) => setStep(v));

  const nextReceivedMsg = MESSAGES.find(
    (m) => !m.isOwn && m.showAt > step && m.showAt - step < 0.9
  );
  const showTyping = !!nextReceivedMsg;

  const callout = CALLOUTS.find((c) => step >= c.range[0] && step < c.range[1])
    ?? CALLOUTS[CALLOUTS.length - 1];

  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <section ref={sectionRef} className="relative" style={{ height: '290vh' }}>
      <div className="sticky top-0 z-50 h-[1px] bg-[#111]">
        <motion.div className="h-full bg-white/20" style={{ width: progressWidth }} />
      </div>

      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        <div className="w-full max-w-5xl mx-auto px-6 grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
          <div className="hidden lg:block">
            <AnimatePresence mode="wait">
              <motion.div
                key={callout.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <div className="inline-flex h-6 items-center px-2.5 rounded border border-[#222] text-[11px] text-[#555] uppercase tracking-widest mb-5">
                  {callout.tag}
                </div>
                <h3 className="text-[28px] font-bold tracking-tight text-white leading-tight mb-3">
                  {callout.title}
                </h3>
                <p className="text-[13px] text-[#555] leading-relaxed max-w-xs">
                  {callout.desc}
                </p>

                <div className="flex items-center gap-2 mt-8">
                  <div className="flex gap-1">
                    {CALLOUTS.map((c) => (
                      <motion.div
                        key={c.id}
                        className="h-px rounded-full bg-white transition-all duration-300"
                        animate={{ width: callout.id === c.id ? 20 : 8, opacity: callout.id === c.id ? 1 : 0.2 }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-[#333]">
                    {CALLOUTS.indexOf(callout) + 1} / {CALLOUTS.length}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="w-full rounded-xl border border-[#1a1a1a] bg-[#080808] overflow-hidden shadow-2xl">
            <div className="h-9 bg-[#0e0e0e] border-b border-[#1a1a1a] flex items-center px-4 gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#2a2a2a]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#2a2a2a]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#2a2a2a]" />
              <div className="flex-1 flex justify-center">
                <div className="h-4 w-40 rounded bg-[#1a1a1a] flex items-center justify-center gap-1.5 px-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#333]" />
                  <div className="h-2 w-24 rounded bg-[#2a2a2a]" />
                </div>
              </div>
            </div>

            <div className="flex" style={{ height: 340 }}>
              <div className="w-44 border-r border-[#1a1a1a] flex flex-col bg-[#080808] hidden sm:flex">
                <div className="px-3 py-2.5 border-b border-[#1a1a1a]">
                  <div className="h-2.5 w-14 rounded bg-white/[0.07] mb-2" />
                  <div className="h-6 rounded-md bg-[#111] flex items-center px-2 gap-1.5">
                    <div className="h-2.5 w-2.5 rounded bg-[#222]" />
                    <div className="h-1.5 w-12 rounded bg-[#222]" />
                  </div>
                </div>
                <div className="flex-1 overflow-hidden py-1">
                  {[
                    { color: '#0ea5e9', active: true, n: 12, m: 22 },
                    { color: '#10b981', active: false, n: 18, m: 30 },
                    { color: '#6366f1', active: false, n: 14, m: 26 },
                    { color: '#f59e0b', active: false, n: 20, m: 18 },
                  ].map((item, i) => (
                    <div key={i} className={`flex items-center gap-2 px-2.5 py-2 ${item.active ? 'bg-[#141414]' : ''}`}>
                      <div className="relative flex-shrink-0">
                        <div className="h-6 w-6 rounded-full" style={{ backgroundColor: item.color + '18', border: `1px solid ${item.color}28` }} />
                        {i < 2 && <div className="absolute -bottom-px -right-px h-2 w-2 rounded-full bg-[#10b981] border border-[#080808]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="h-[7px] rounded mb-1" style={{ width: item.n * 3 + 'px', backgroundColor: item.active ? 'rgba(255,255,255,0.15)' : '#222' }} />
                        <div className="h-[5px] rounded bg-[#1a1a1a]" style={{ width: item.m * 2 + 'px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col min-w-0">
                <div className="h-10 border-b border-[#1a1a1a] flex items-center px-3.5 gap-2.5 flex-shrink-0">
                  <div className="relative">
                    <div className="h-6 w-6 rounded-full bg-[#0ea5e912] border border-[#0ea5e928]" />
                    <motion.div
                      className="absolute -bottom-px -right-px h-2 w-2 rounded-full bg-[#10b981] border border-[#080808]"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  <div>
                    <div className="h-[9px] w-16 rounded bg-white/10 mb-1" />
                    <div className="h-[7px] w-8 rounded bg-[#10b981]/40" />
                  </div>
                  <div className="ml-auto flex gap-1.5">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-5 w-5 rounded bg-[#111] border border-[#1a1a1a]" />
                    ))}
                  </div>
                </div>

                <div className="flex-1 px-3.5 py-3 flex flex-col justify-end overflow-hidden gap-0.5 relative">
                  <div
                    className="absolute inset-0 opacity-[0.015] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                  />

                  {MESSAGES.map((msg) => (
                    <ChatMsg key={msg.id} msg={msg} step={step} />
                  ))}

                  <AnimatePresence>
                    {showTyping && <TypingDots />}
                  </AnimatePresence>
                </div>

                <div className="h-11 border-t border-[#1a1a1a] flex items-center px-3 gap-2 flex-shrink-0">
                  <div className="h-6 w-6 rounded-lg bg-[#111] border border-[#1a1a1a] flex-shrink-0" />
                  <div className="flex-1 h-6 rounded-lg bg-[#0e0e0e] border border-[#1a1a1a] flex items-center px-2.5 gap-2">
                    <motion.div
                      className="h-[7px] rounded bg-[#2a2a2a]"
                      animate={{ width: ['40px', '90px', '60px', '80px'] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                      className="h-3 w-px bg-white/50"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  </div>
                  <motion.div
                    className="h-6 w-6 rounded-lg bg-white flex items-center justify-center flex-shrink-0"
                    whileHover={{ scale: 1.05 }}
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
                      <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {step < 0.4 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
            >
              <span className="text-[10px] text-[#333] uppercase tracking-widest">Scroll to explore</span>
              <motion.div
                animate={{ y: [0, 5, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="w-4 h-6 rounded-full border border-[#222] flex items-start justify-center pt-1"
              >
                <div className="w-0.5 h-1.5 bg-[#333] rounded-full" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const FEATURES = [
    { label: 'Channels & Groups', desc: 'Create channels for unlimited audiences or group chats with thousands of members.' },
    { label: 'End-to-End Encryption', desc: 'Every message is encrypted. Zero-knowledge architecture — not even we can read it.' },
    { label: 'Cross-Device Sync', desc: 'Switch between phone, tablet, and desktop seamlessly. Your history is always there.' },
    { label: 'HD Voice & Video', desc: 'Crystal-clear calls with noise cancellation built in. No third-party apps needed.' },
    { label: 'Reactions & Threads', desc: 'Reply in threads, react with any emoji, and keep conversations tightly organized.' },
    { label: 'File Sharing', desc: 'Send images, videos, and documents up to 4 GB. Preview everything inline.' },
  ];

  const LOGOS = ['Acme', 'Nimbus', 'Vertex', 'Orbit', 'Pulse', 'Layer'];

  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, #ffffff07 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />

      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${scrolled ? 'bg-black/80 backdrop-blur-md border-b border-[#1a1a1a]' : ''}`}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
              Twiky
            </div>
            <div className="hidden md:flex items-center gap-5 text-[13px] text-[#888]">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#security" className="hover:text-white transition-colors">Security</a>
              <a href="#download" className="hover:text-white transition-colors">Download</a>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            {isAuthenticated ? (
              <button onClick={() => router.push('/chat')} className="h-8 px-4 rounded-md bg-white text-black font-medium hover:bg-[#e5e5e5] transition-colors">
                Open App
              </button>
            ) : (
              <>
                <Link href="/account/signin" className="text-[#888] hover:text-white transition-colors">Log in</Link>
                <Link href="/account/signup" className="h-8 px-4 rounded-md bg-white text-black font-medium hover:bg-[#e5e5e5] transition-colors">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="relative pt-36 pb-4 px-6">
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <motion.div {...fade(0)}>
            <div className="inline-flex items-center gap-2 h-7 px-3 rounded-full border border-[#222] bg-[#0a0a0a] text-[#666] text-[11px] mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              Twiky Web is now live
              <span className="text-[#333] mx-1">—</span>
              <Link href="/account/signup" className="text-white hover:underline underline-offset-2">Get started →</Link>
            </div>
          </motion.div>

          <motion.h1 {...fade(0.05)} className="text-5xl md:text-[64px] font-bold leading-[1.05] tracking-[-0.03em] text-white mb-5">
            Messaging built for the modern web.
          </motion.h1>

          <motion.p {...fade(0.1)} className="text-[#666] text-base max-w-lg mx-auto mb-8 leading-relaxed">
            Fast, secure, and beautifully simple. Twiky gives teams and communities a better way to communicate.
          </motion.p>

          <motion.div {...fade(0.15)} className="flex items-center justify-center gap-3">
            <button onClick={() => router.push(isAuthenticated ? '/chat' : '/account/signup')}
              className="h-9 px-5 rounded-md bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] transition-colors">
              Start for free
            </button>
            <button className="h-9 px-5 rounded-md border border-[#222] text-[#888] text-sm hover:border-[#333] hover:text-white transition-colors">
              Download app
            </button>
          </motion.div>
        </div>
      </section>

      <ScrollDemo />

      <section className="border-y border-[#111] py-8 px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[11px] text-[#333] uppercase tracking-widest mb-6">Trusted by teams at</p>
          <div className="flex items-center justify-center gap-10 flex-wrap">
            {LOGOS.map((name) => (
              <span key={name} className="text-[#2a2a2a] text-sm font-semibold tracking-wide hover:text-[#555] transition-colors cursor-default">{name}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-28 px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          <motion.div {...inView()} className="mb-16">
            <p className="text-[11px] text-[#444] uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white max-w-lg">Everything you need to communicate.</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-px bg-[#111] border border-[#111] rounded-xl overflow-hidden">
            {FEATURES.map(({ label, desc }, i) => (
              <motion.div key={label} {...inView(i * 0.05)} className="bg-black p-6 hover:bg-[#080808] transition-colors group">
                <div className="h-px w-6 bg-[#2a2a2a] mb-4 group-hover:bg-white group-hover:w-10 transition-all duration-300" />
                <h3 className="text-sm font-semibold text-white mb-2">{label}</h3>
                <p className="text-[13px] text-[#555] leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="py-28 px-6 border-t border-[#111] relative z-10">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <motion.div {...inView()}>
            <p className="text-[11px] text-[#444] uppercase tracking-widest mb-3">Security</p>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-5">Privacy is not a feature. It's the foundation.</h2>
            <p className="text-[#555] text-[13px] leading-relaxed mb-8">
              Every message is protected with end-to-end encryption. Your data never touches our servers in a readable form.
            </p>
            <div className="space-y-3">
              {['End-to-end encryption by default', 'Zero-knowledge architecture', 'Open-source cryptography', 'GDPR & SOC 2 compliant'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-[13px] text-[#555]">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#10b981] flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div {...inView(0.1)}>
            <div className="rounded-xl border border-[#1a1a1a] bg-[#080808] p-6 font-mono text-[12px]">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-[#10b981]" />
                <span className="text-[#333] text-[11px]">encryption.ts</span>
              </div>
              <div className="space-y-1 text-[#333]">
                <div><span className="text-[#555]">const</span> <span className="text-[#777]">key</span> = <span className="text-[#444]">await</span> crypto.<span className="text-white">generateKey</span>({'{'}</div>
                <div className="pl-4"><span className="text-[#555]">name</span>: <span className="text-[#444]">'AES-GCM'</span>,</div>
                <div className="pl-4"><span className="text-[#555]">length</span>: <span className="text-[#777]">256</span>,</div>
                <div>{'}'});</div>
                <div className="mt-3"><span className="text-[#555]">const</span> <span className="text-[#777]">encrypted</span> = <span className="text-[#444]">await</span></div>
                <div className="pl-4">crypto.<span className="text-white">encrypt</span>(message, key);</div>
                <div className="mt-3 text-[#2a2a2a]">{'// only recipient can decrypt'}</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="download" className="py-28 px-6 border-t border-[#111] relative z-10">
        <div className="max-w-xl mx-auto text-center">
          <motion.div {...inView()}>
            <h2 className="text-4xl font-bold tracking-[-0.03em] text-white mb-4">Start messaging today.</h2>
            <p className="text-[#555] text-[13px] mb-8">Free forever. No credit card. Available on iOS, Android, and the web.</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => router.push(isAuthenticated ? '/chat' : '/account/signup')}
                className="h-9 px-5 rounded-md bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] transition-colors">
                Get started free
              </button>
              <button className="h-9 px-5 rounded-md border border-[#222] text-[#888] text-sm hover:border-[#333] hover:text-white transition-colors">
                Download app
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-[#111] py-10 px-6 relative z-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
            Twiky
          </div>
          <div className="flex gap-6 text-[13px] text-[#333]">
            {['Privacy', 'Terms', 'Security', 'API', 'Blog'].map(l => (
              <a key={l} href="#" className="hover:text-white transition-colors">{l}</a>
            ))}
          </div>
          <p className="text-[#2a2a2a] text-[11px]">© {new Date().getFullYear()} Twiky</p>
        </div>
      </footer>
    </div>
  );
}
