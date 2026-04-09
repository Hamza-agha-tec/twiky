'use client';

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AnimatedTooltipPreview } from "@/components/AnimatedTooltipPreview";
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
  { id: 'speed', range: [0, 3.2], tag: 'Instant', title: 'Messages arrive the moment you send.' },
  { id: 'media', range: [3.2, 5.5], tag: 'Media', title: 'Share anything, beautifully.' },
  { id: 'voice', range: [5.5, 7.8], tag: 'Voice', title: 'Voice notes, elevated.' },
  { id: 'secure', range: [7.8, 9], tag: 'Security', title: 'Zero-knowledge. Always.' },
];

const CHAT_BEAMS = [
  {
    id: 1,
    path: 'M 18 104 C 132 104, 168 104, 222 104 S 320 104, 376 104 L 486 104 C 522 104, 540 122, 540 154 L 540 168 C 540 194, 556 208, 582 208 L 846 208',
    duration: 8.6,
    delay: 0,
  },
  {
    id: 2,
    path: 'M 10 170 C 122 170, 156 170, 210 170 S 306 170, 360 170 L 438 170 C 474 170, 492 188, 492 220 L 492 240 C 492 268, 510 284, 538 284 L 854 284',
    duration: 9.4,
    delay: 0.5,
  },
  {
    id: 3,
    path: 'M 24 236 C 138 236, 174 236, 230 236 S 328 236, 384 236 L 560 236 C 594 236, 612 254, 612 286 L 612 304 C 612 332, 628 348, 656 348 L 840 348',
    duration: 10.2,
    delay: 1,
  },
];

const CONTACTS = [
  { color: '#0ea5e9', name: 'Alex',  photo: 'https://randomuser.me/api/portraits/men/1.jpg',   online: true,  unread: 2, preview: 'Crystal clear quality 🎙️', time: '2:34 PM' },
  { color: '#10b981', name: 'Sam',   photo: 'https://randomuser.me/api/portraits/men/15.jpg',  online: true,  unread: 0, preview: 'See you tomorrow!',          time: '1:12 PM' },
  { color: '#6366f1', name: 'Maya',  photo: 'https://randomuser.me/api/portraits/women/3.jpg', online: false, unread: 5, preview: 'Did you see the update?',     time: '11:48 AM' },
  { color: '#f59e0b', name: 'Zoe',   photo: 'https://randomuser.me/api/portraits/women/11.jpg',online: false, unread: 1, preview: 'On my way 🚀',                time: '9:05 AM' },
];

const ALEX_PHOTO = 'https://randomuser.me/api/portraits/men/1.jpg';
const CHAT_IMAGE  = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80';

function UserAvatar({ photo, color = '#0ea5e9', initial = 'A', size = 28 }: {
  photo?: string; color?: string; initial?: string; size?: number;
}) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={initial}
        width={size}
        height={size}
        style={{ width: size, height: size, minWidth: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, minWidth: size, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      backgroundColor: color + '22', border: `1px solid ${color}44`, color,
      fontSize: size <= 26 ? 10 : 12, fontWeight: 700,
    }}>
      {initial}
    </div>
  );
}

function TypingDots({ dark }: { dark: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 6 }}
      transition={{ duration: 0.18 }}
      className="flex items-end gap-2 mb-1"
    >
      <UserAvatar photo={ALEX_PHOTO} initial="A" size={24} />
      <div
        className="rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex gap-1 items-center"
        style={{
          background: dark ? '#1e1e1e' : '#f0f0f0',
          border: `1px solid ${dark ? '#2a2a2a' : '#e5e5e5'}`,
        }}
      >
        {[0, 0.18, 0.36].map((d, i) => (
          <motion.div
            key={i}
            style={{ width: 6, height: 6, borderRadius: '50%', background: dark ? '#555' : '#bbb' }}
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: d }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function ChatMsg({ msg, step, dark }: { msg: typeof MESSAGES[0]; step: number; dark: boolean }) {
  const visible = step >= msg.showAt;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={msg.isOwn ? { opacity: 0, x: 28, scale: 0.88, y: 4 } : { opacity: 0, x: -28, scale: 0.88, y: 4 }}
          animate={{ opacity: 1, x: 0, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32, mass: 0.7 }}
          className={`flex items-end gap-2 ${msg.isOwn ? 'justify-end' : 'justify-start'} mb-1`}
        >
          {!msg.isOwn && <UserAvatar photo={ALEX_PHOTO} initial="A" size={26} />}

          {msg.type === 'text' && (
            <motion.div
              className="max-w-[72%] rounded-2xl px-3.5 py-2 text-[12px] leading-relaxed"
              style={{
                background: msg.isOwn
                  ? '#0ea5e9'
                  : dark ? '#1e1e1e' : '#f0f0f0',
                color: msg.isOwn
                  ? 'white'
                  : dark ? 'white' : '#111',
                borderRadius: msg.isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                border: msg.isOwn ? 'none' : `1px solid ${dark ? '#2a2a2a' : '#e5e5e5'}`,
                boxShadow: msg.isOwn ? '0 4px 14px rgba(14,165,233,0.3)' : 'none',
              }}
            >
              {msg.content}
              {msg.isOwn && (
                <span className="ml-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {step >= msg.showAt + 1 ? '✓✓' : '✓'}
                </span>
              )}
            </motion.div>
          )}

          {msg.type === 'image' && (
            <motion.div
              className="w-44 h-28 rounded-2xl overflow-hidden relative"
              style={{ border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}
              initial={{ filter: 'blur(8px)', scale: 0.95 }}
              animate={{ filter: 'blur(0px)', scale: 1 }}
              transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CHAT_IMAGE}
                alt="Shared photo"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div
                className="absolute bottom-1.5 right-2 rounded-full px-1.5 py-0.5"
                style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
              >
                <span className="text-[9px] text-white/90 font-medium">Photo</span>
              </div>
            </motion.div>
          )}

          {msg.type === 'voice' && (
            <div
              className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 min-w-[160px]"
              style={{
                background: dark ? '#1e1e1e' : '#f0f0f0',
                border: `1px solid ${dark ? '#2a2a2a' : '#e5e5e5'}`,
                borderRadius: '18px 18px 18px 4px',
              }}
            >
              <motion.div
                className="h-7 w-7 rounded-full bg-[#0ea5e9] flex items-center justify-center flex-shrink-0"
                animate={{ boxShadow: ['0 0 0 0 rgba(14,165,233,0.4)', '0 0 0 6px rgba(14,165,233,0)', '0 0 0 0 rgba(14,165,233,0)'] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z" /></svg>
              </motion.div>
              <div className="flex items-center gap-[2px] h-5 flex-1">
                {WAVE.map((h, i) => (
                  <motion.div
                    key={i}
                    className="w-[2px] rounded-full bg-[#0ea5e9]"
                    style={{ height: `${Math.max(15, h * 0.55)}%` }}
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ delay: i * 0.018, duration: 0.25, ease: 'backOut' }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 10, color: dark ? '#555' : '#aaa' }}>{msg.content}</span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChatCardBeams({ dark }: { dark: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: dark
            ? 'radial-gradient(circle at 50% 20%, rgba(251,191,36,0.07), transparent 40%)'
            : 'radial-gradient(circle at 50% 20%, rgba(251,191,36,0.05), transparent 40%)',
        }}
      />
      <svg
        viewBox="0 0 860 480"
        className="absolute inset-0 h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="chat-beam-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0.06 0 0 0 0
                      0 0.72 0 0 0
                      0 0 0.32 0 0
                      0 0 0 1 0"
            />
          </filter>
          <linearGradient id="chat-beam-trace" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(16,185,129,0)" />
            <stop offset="28%" stopColor="rgba(16,185,129,0.08)" />
            <stop offset="50%" stopColor="rgba(16,185,129,0.78)" />
            <stop offset="72%" stopColor="rgba(16,185,129,0.08)" />
            <stop offset="100%" stopColor="rgba(16,185,129,0)" />
          </linearGradient>
        </defs>

        {CHAT_BEAMS.map((beam) => (
          <g key={beam.id}>
            <path
              d={beam.path}
              stroke={dark ? 'rgba(255,255,255,0.11)' : 'rgba(15,23,42,0.12)'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="2 10"
            />
            <path
              d={beam.path}
              stroke={dark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={beam.path}
              stroke="url(#chat-beam-trace)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="100"
              strokeDasharray="12 88"
            />
            <path
              d={beam.path}
              stroke="url(#chat-beam-trace)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="100"
              strokeDasharray="12 88"
              strokeDashoffset="-88"
            />
            <motion.rect
              width="72"
              height="3"
              rx="999"
              fill="url(#chat-beam-trace)"
              initial={{ offsetDistance: '0%' }}
              animate={{ offsetDistance: ['0%', '100%'] }}
              transition={{
                duration: beam.duration,
                delay: beam.delay,
                ease: 'linear',
                repeat: Infinity,
              }}
              style={{
                offsetPath: `path("${beam.path}")`,
                offsetRotate: '0deg',
                transformBox: 'fill-box',
                x: -36,
                y: -1.5,
              }}
            />
            <motion.circle
              r="2.5"
              fill="rgba(16,185,129,0.95)"
              initial={{ offsetDistance: '0%' }}
              animate={{ offsetDistance: ['0%', '100%'] }}
              transition={{
                duration: beam.duration,
                delay: beam.delay,
                ease: 'linear',
                repeat: Infinity,
              }}
              style={{
                offsetPath: `path("${beam.path}")`,
                offsetRotate: '0deg',
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

function ScrollDemo({ dark }: { dark: boolean }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  const rawStep = useTransform(scrollYProgress, [0, 1], [0, 9]);
  const [step, setStep] = useState(0);
  useMotionValueEvent(rawStep, 'change', (v) => setStep(v));

  const nextReceivedMsg = MESSAGES.find((m) => !m.isOwn && m.showAt > step && m.showAt - step < 0.9);
  const showTyping = !!nextReceivedMsg;
  const callout = CALLOUTS.find((c) => step >= c.range[0] && step < c.range[1]) ?? CALLOUTS[CALLOUTS.length - 1];

  const cardBorder  = dark ? '#1e1e1e' : '#e5e7eb';
  const titleBarBg  = dark ? '#0d0d0d' : '#f5f5f7';
  const sidebarBg   = dark ? '#0a0a0a' : '#f9fafb';
  const chatAreaBg  = dark ? '#080808' : '#fafafa';
  const headerBg    = dark ? '#0a0a0a' : '#ffffff';

  return (
    <section ref={sectionRef} className="relative -mt-8" style={{ height: '290vh' }}>
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-[1] h-24"
        style={{
          background: dark
            ? 'linear-gradient(to bottom, rgba(0,0,0,0.96), rgba(0,0,0,0.72), transparent)'
            : 'linear-gradient(to bottom, rgba(245,245,247,0.96), rgba(245,245,247,0.7), transparent)',
        }}
      />
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        <div className="w-full max-w-4xl mx-auto px-6">

          {/* App window */}
          <div className="relative">
            <div className="absolute inset-y-0 -left-24 -right-24 z-0">
              <ChatCardBeams dark={dark} />
            </div>

            <div
              className="relative z-10 w-full rounded-2xl overflow-hidden"
              style={{
                border: `1px solid ${cardBorder}`,
                background: chatAreaBg,
                boxShadow: dark
                  ? '0 40px 100px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)'
                  : '0 40px 100px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.05)',
              }}
            >
              {/* macOS title bar */}
              <div
                className="relative z-10 flex items-center px-4 gap-1.5"
                style={{ height: 40, background: titleBarBg, borderBottom: `1px solid ${cardBorder}` }}
              >
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              <div className="flex-1 flex justify-center">
                <div
                  className="h-5 rounded-md flex items-center gap-1.5 px-3"
                  style={{
                    background: dark ? '#1a1a1a' : '#ebebeb',
                    border: `1px solid ${dark ? '#2a2a2a' : '#ddd'}`,
                    minWidth: 168,
                  }}
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={dark ? '#444' : '#aaa'} strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span style={{ fontSize: 10, color: dark ? '#444' : '#aaa', fontFamily: 'monospace', letterSpacing: '-0.02em' }}>twiky.app/chat</span>
                </div>
              </div>
              </div>

              <div className="relative z-10 flex" style={{ height: 480 }}>
              {/* Sidebar */}
              <div
                className="w-56 flex-col hidden sm:flex"
                style={{ background: sidebarBg, borderRight: `1px solid ${cardBorder}` }}
              >
                <div className="px-3 py-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <p style={{ fontSize: 10, color: dark ? '#333' : '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>
                    Messages
                  </p>
                  <div
                    className="h-7 rounded-lg flex items-center px-2.5 gap-2"
                    style={{ background: dark ? '#111' : '#efefef', border: `1px solid ${dark ? '#1e1e1e' : '#e5e5e5'}` }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={dark ? '#333' : '#ccc'} strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <div style={{ height: 6, width: 80, borderRadius: 3, background: dark ? '#1e1e1e' : '#e0e0e0' }} />
                  </div>
                </div>

                <div className="flex-1 overflow-hidden py-1">
                  {CONTACTS.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
                      style={{
                        background: i === 0 ? (dark ? 'rgba(14,165,233,0.07)' : 'rgba(14,165,233,0.06)') : 'transparent',
                        borderLeft: i === 0 ? '2px solid #0ea5e9' : '2px solid transparent',
                      }}
                    >
                      <div className="relative flex-shrink-0">
                        <UserAvatar photo={item.photo} color={item.color} initial={item.name[0]} size={34} />
                        {item.online && (
                          <div
                            className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-[#10b981]"
                            style={{ border: `2px solid ${sidebarBg}` }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? (dark ? 'white' : '#111') : (dark ? '#555' : '#999') }}>
                            {item.name}
                          </span>
                          <span style={{ fontSize: 9, color: dark ? '#2a2a2a' : '#bbb' }}>{item.time}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <p style={{ fontSize: 10, color: dark ? '#2a2a2a' : '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {item.preview}
                          </p>
                          {item.unread > 0 && (
                            <div
                              className="h-4 min-w-[16px] rounded-full flex items-center justify-center px-1 flex-shrink-0"
                              style={{ backgroundColor: item.color }}
                            >
                              <span style={{ fontSize: 9, color: 'white', fontWeight: 700 }}>{item.unread}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main chat area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Chat header */}
                <div
                  className="h-13 flex items-center px-4 gap-3 flex-shrink-0"
                  style={{ height: 52, borderBottom: `1px solid ${cardBorder}`, background: headerBg }}
                >
                  <div className="relative">
                    <UserAvatar photo={ALEX_PHOTO} initial="A" size={36} />
                    <motion.div
                      className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-[#10b981]"
                      style={{ border: `2px solid ${headerBg}` }}
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: dark ? 'white' : '#111', lineHeight: 1.2 }}>Alex</p>
                    <p style={{ fontSize: 10, color: '#10b981' }}>● Online</p>
                  </div>
                  <div className="ml-auto flex gap-1.5">
                    {[
                      'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
                      'M23 7l-7 5 7 5V7zM1 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5z',
                    ].map((d, i) => (
                      <div
                        key={i}
                        className="h-7 w-7 rounded-lg flex items-center justify-center"
                        style={{ background: dark ? '#111' : '#f5f5f5', border: `1px solid ${cardBorder}` }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={dark ? '#444' : '#aaa'} strokeWidth="2">
                          <path d={d} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Messages */}
                <div
                  className="flex-1 px-4 py-3 flex flex-col justify-end overflow-hidden gap-0.5 relative"
                  style={{
                    background: chatAreaBg,
                    backgroundImage: `radial-gradient(circle, ${dark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)'} 1px, transparent 1px)`,
                    backgroundSize: '20px 20px',
                  }}
                >
                  {MESSAGES.map((msg) => (
                    <ChatMsg key={msg.id} msg={msg} step={step} dark={dark} />
                  ))}
                  <AnimatePresence>
                    {showTyping && <TypingDots dark={dark} />}
                  </AnimatePresence>
                </div>

                {/* Composer */}
                <div
                  className="flex items-center px-3 gap-2 flex-shrink-0"
                  style={{ height: 52, borderTop: `1px solid ${cardBorder}`, background: headerBg }}
                >
                  <div
                    className="h-7 w-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                    style={{ background: dark ? '#111' : '#f5f5f5', border: `1px solid ${cardBorder}` }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={dark ? '#333' : '#ccc'} strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div
                    className="flex-1 h-7 rounded-lg flex items-center px-2.5 gap-2"
                    style={{ background: dark ? '#111' : '#f5f5f5', border: `1px solid ${cardBorder}` }}
                  >
                    <motion.div
                      className="h-[7px] rounded"
                      style={{ background: dark ? '#2a2a2a' : '#e0e0e0' }}
                      animate={{ width: ['40px', '90px', '60px', '80px'] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                      style={{ height: 12, width: 1, background: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)' }}
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  </div>
                  <motion.div
                    className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: '#0ea5e9' }}
                    whileHover={{ scale: 1.07 }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Callout pill */}
        <div className="hidden lg:block absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={callout.id}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex items-center gap-3 rounded-full px-5 py-2.5 whitespace-nowrap"
              style={{
                background: dark ? 'rgba(8,8,8,0.88)' : 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(20px)',
                border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.1)',
              }}
            >
              <span style={{ fontSize: 10, color: dark ? '#444' : '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{callout.tag}</span>
              <div style={{ width: 1, height: 12, background: dark ? '#222' : '#e0e0e0' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: dark ? 'white' : '#111' }}>{callout.title}</span>
              <div className="flex gap-1 ml-1">
                {CALLOUTS.map((c) => (
                  <motion.div
                    key={c.id}
                    style={{ height: 1, borderRadius: 1, background: '#0ea5e9' }}
                    animate={{ width: callout.id === c.id ? 14 : 5, opacity: callout.id === c.id ? 1 : 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {step < 0.4 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
            >
              <span style={{ fontSize: 10, color: dark ? '#333' : '#bbb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Scroll to explore</span>
              <motion.div
                animate={{ y: [0, 5, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="w-4 h-6 rounded-full flex items-start justify-center pt-1"
                style={{ border: dark ? '1px solid #222' : '1px solid #ddd' }}
              >
                <div style={{ width: 2, height: 6, borderRadius: 1, background: dark ? '#333' : '#ccc' }} />
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
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const FEATURES = [
    { label: 'Channels & Groups',      desc: 'Create channels for unlimited audiences or group chats with thousands of members.' },
    { label: 'End-to-End Encryption',  desc: 'Every message is encrypted. Zero-knowledge architecture — not even we can read it.' },
    { label: 'Cross-Device Sync',       desc: 'Switch between phone, tablet, and desktop seamlessly. Your history is always there.' },
    { label: 'HD Voice & Video',        desc: 'Crystal-clear calls with noise cancellation built in. No third-party apps needed.' },
    { label: 'Reactions & Threads',     desc: 'Reply in threads, react with any emoji, and keep conversations tightly organized.' },
    { label: 'File Sharing',            desc: 'Send images, videos, and documents up to 4 GB. Preview everything inline.' },
  ];

  const LOGOS = ['Acme', 'Nimbus', 'Vertex', 'Orbit', 'Pulse', 'Layer'];

  const pageBg     = dark ? 'bg-black'       : 'bg-[#f5f5f7]';
  const textColor  = dark ? 'text-white'     : 'text-[#1d1d1f]';
  const textMuted  = dark ? 'text-[#666]'   : 'text-[#6e6e73]';
  const divider    = dark ? '#111'           : '#e5e5e5';
  const dotOverlay = dark ? '#ffffff07'      : '#00000005';

  const navShellClass = scrolled
    ? dark
      ? 'mt-3 max-w-4xl rounded-2xl bg-black/75 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl'
      : 'mt-3 max-w-4xl rounded-2xl bg-white/88 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-xl'
    : 'max-w-5xl';

  return (
    <div className={`min-h-screen ${pageBg} ${textColor} font-sans antialiased transition-colors duration-300`}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: `radial-gradient(circle, ${dotOverlay} 1px, transparent 1px)`, backgroundSize: '28px 28px' }}
      />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 transition-all duration-300">
        <div className={`mx-auto h-14 px-6 flex items-center justify-between transition-all duration-300 ${navShellClass}`}>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill={dark ? 'white' : '#1d1d1f'}>
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
              Twiky
            </div>
            <div className={`hidden md:flex items-center gap-5 text-[13px] ${textMuted}`}>
              <a href="#features" className="hover:text-current transition-colors">Features</a>
              <a href="#team" className="hover:text-current transition-colors">Team</a>
              <a href="#security" className="hover:text-current transition-colors">Security</a>
              <a href="#download" className="hover:text-current transition-colors">Download</a>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            {/* Dark / light toggle */}
            <button
              onClick={() => setDark(!dark)}
              aria-label="Toggle theme"
              className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-md backdrop-blur-md transition-colors"
              style={{
                background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
                border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.7)',
                boxShadow: dark ? '0 8px 24px rgba(0,0,0,0.22)' : '0 8px 20px rgba(15,23,42,0.08)',
                color: dark ? '#fafafa' : '#111827',
              }}
            >
              {dark ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
              )}
            </button>

            {isAuthenticated ? (
              <button
                onClick={() => router.push('/chat')}
                className="h-8 px-4 rounded-md font-medium text-sm transition-colors"
                style={{ background: dark ? 'white' : '#1d1d1f', color: dark ? 'black' : 'white' }}
              >
                Open App
              </button>
            ) : (
              <>
                <Link href="/account/signin" className={`${textMuted} hover:text-current transition-colors`}>Log in</Link>
                <Link
                  href="/account/signup"
                  className="h-8 px-4 rounded-md font-medium text-sm transition-colors inline-flex items-center"
                  style={{ background: dark ? 'white' : '#1d1d1f', color: dark ? 'black' : 'white' }}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-36 pb-4 px-6">
        <div
          className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
          style={{
            maskImage: 'linear-gradient(to bottom, black 0%, black 62%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 62%, transparent 100%)',
          }}
        >
          <motion.div
            className="absolute left-0 top-0 h-[520px] w-[46%]"
            initial={{ opacity: 0, x: -36, y: -20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
            style={{
              background: dark
                ? 'linear-gradient(136deg, rgba(16,185,129,0.42) 0%, rgba(16,185,129,0.16) 18%, rgba(16,185,129,0.04) 42%, transparent 68%)'
                : 'linear-gradient(136deg, rgba(16,185,129,0.36) 0%, rgba(16,185,129,0.13) 18%, rgba(16,185,129,0.035) 42%, transparent 68%)',
              clipPath: 'polygon(0 0, 100% 0, 54% 100%, 0 100%)',
              filter: 'blur(2px)',
            }}
          />
          <motion.div
            className="absolute right-0 top-0 h-[520px] w-[46%]"
            initial={{ opacity: 0, x: 36, y: -20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
            style={{
              background: dark
                ? 'linear-gradient(224deg, rgba(16,185,129,0.38) 0%, rgba(16,185,129,0.15) 18%, rgba(16,185,129,0.04) 42%, transparent 68%)'
                : 'linear-gradient(224deg, rgba(16,185,129,0.34) 0%, rgba(16,185,129,0.12) 18%, rgba(16,185,129,0.03) 42%, transparent 68%)',
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 46% 100%)',
              filter: 'blur(2px)',
            }}
          />
          <motion.div
            className="absolute left-0 top-0 h-[460px] w-[34%]"
            initial={{ opacity: 0, x: -28, y: -14 }}
            animate={{ opacity: dark ? 0.88 : 0.72, x: 0, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
            style={{
              background: dark
                ? 'linear-gradient(135deg, rgba(16,185,129,0.82) 0%, rgba(16,185,129,0.26) 16%, transparent 38%)'
                : 'linear-gradient(135deg, rgba(16,185,129,0.72) 0%, rgba(16,185,129,0.22) 16%, transparent 38%)',
              clipPath: 'polygon(0 0, 100% 0, 32% 100%, 0 100%)',
              filter: 'blur(0.6px)',
              mixBlendMode: dark ? 'screen' : 'multiply',
            }}
          />
          <motion.div
            className="absolute right-0 top-0 h-[460px] w-[34%]"
            initial={{ opacity: 0, x: 28, y: -14 }}
            animate={{ opacity: dark ? 0.82 : 0.68, x: 0, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.22 }}
            style={{
              background: dark
                ? 'linear-gradient(225deg, rgba(16,185,129,0.76) 0%, rgba(16,185,129,0.24) 16%, transparent 38%)'
                : 'linear-gradient(225deg, rgba(16,185,129,0.68) 0%, rgba(16,185,129,0.2) 16%, transparent 38%)',
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 68% 100%)',
              filter: 'blur(0.6px)',
              mixBlendMode: dark ? 'screen' : 'multiply',
            }}
          />
          <motion.div
            className="absolute left-1/2 top-16 h-44 w-[38rem] -translate-x-1/2 rounded-full blur-3xl"
            initial={{ opacity: 0, scaleX: 0.92, y: -12 }}
            animate={{ opacity: dark ? 0.28 : 0.2, scaleX: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.28 }}
            style={{
              background: dark
                ? 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 34%, transparent 72%)'
                : 'radial-gradient(circle, rgba(16,185,129,0.10) 0%, rgba(16,185,129,0.03) 36%, transparent 72%)',
            }}
          />
        </div>
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <motion.div {...fade(0)}>
            <div
              className="inline-flex items-center gap-2 h-7 px-3 rounded-full text-[11px] mb-8"
              style={{
                border: dark ? '1px solid #222' : '1px solid #e5e5e5',
                background: dark ? '#0a0a0a' : 'white',
                color: dark ? '#666' : '#888',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              Twiky Web is now live
              <span style={{ color: dark ? '#333' : '#ccc', margin: '0 4px' }}>—</span>
              <Link href="/account/signup" className={`${textColor} hover:underline underline-offset-2`}>Get started →</Link>
            </div>
          </motion.div>

          <motion.h1 {...fade(0.05)} className={`text-5xl md:text-[64px] font-bold leading-[1.05] tracking-[-0.03em] ${textColor} mb-5`}>
            Messaging built for the modern web.
          </motion.h1>

          <motion.p {...fade(0.1)} className={`${textMuted} text-base max-w-lg mx-auto mb-8 leading-relaxed`}>
            Fast, secure, and beautifully simple. Twiky gives teams and communities a better way to communicate.
          </motion.p>

          <motion.div {...fade(0.15)} className="flex items-center justify-center gap-3">
            <button
              onClick={() => router.push(isAuthenticated ? '/chat' : '/account/signup')}
              className="h-9 px-5 rounded-md text-sm font-semibold transition-colors"
              style={{ background: dark ? 'white' : '#1d1d1f', color: dark ? 'black' : 'white' }}
            >
              Start for free
            </button>
            <button
              className="h-9 px-5 rounded-md text-sm transition-colors"
              style={{
                border: dark ? '1px solid #222' : '1px solid #e5e5e5',
                color: dark ? '#888' : '#666',
                background: 'transparent',
              }}
            >
              Download app
            </button>
          </motion.div>
        </div>
      </section>

      <ScrollDemo dark={dark} />

      {/* Logos */}
      <section className="py-8 px-6 relative z-10" style={{ borderTop: `1px solid ${divider}`, borderBottom: `1px solid ${divider}` }}>
        <div className="max-w-5xl mx-auto">
          <p className={`text-center text-[11px] uppercase tracking-widest mb-6 ${dark ? 'text-[#333]' : 'text-[#bbb]'}`}>Trusted by teams at</p>
          <div className="flex items-center justify-center gap-10 flex-wrap">
            {LOGOS.map((name) => (
              <span
                key={name}
                className="text-sm font-semibold tracking-wide cursor-default transition-colors"
                style={{ color: dark ? '#2a2a2a' : '#ccc' }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-28 px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          <motion.div {...inView()} className="mb-16">
            <p style={{ fontSize: 11, color: dark ? '#444' : '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Features</p>
            <h2 className={`text-3xl md:text-4xl font-bold tracking-tight ${textColor} max-w-lg`}>
              Everything you need to communicate.
            </h2>
          </motion.div>
          <div
            className="grid md:grid-cols-3 gap-px rounded-xl overflow-hidden"
            style={{ background: divider, border: `1px solid ${divider}` }}
          >
            {FEATURES.map(({ label, desc }, i) => (
              <motion.div
                key={label}
                {...inView(i * 0.05)}
                className="p-6 transition-colors group"
                style={{ background: dark ? 'black' : 'white' }}
              >
                <div
                  className="h-px w-6 mb-4 group-hover:w-10 transition-all duration-300"
                  style={{ background: dark ? '#2a2a2a' : '#e0e0e0' }}
                />
                <h3 className={`text-sm font-semibold mb-2 ${textColor}`}>{label}</h3>
                <p style={{ fontSize: 13, color: dark ? '#555' : '#888', lineHeight: 1.6 }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-28 px-6 relative z-10" style={{ borderTop: `1px solid ${divider}` }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <motion.div {...inView()}>
            <p style={{ fontSize: 11, color: dark ? '#444' : '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Security</p>
            <h2 className={`text-3xl font-bold tracking-tight ${textColor} mb-5`}>
              Privacy is not a feature. It&apos;s the foundation.
            </h2>
            <p style={{ fontSize: 13, color: dark ? '#555' : '#888', lineHeight: 1.7, marginBottom: 32 }}>
              Every message is protected with end-to-end encryption. Your data never touches our servers in a readable form.
            </p>
            <div className="space-y-3">
              {['End-to-end encryption by default', 'Zero-knowledge architecture', 'Open-source cryptography', 'GDPR & SOC 2 compliant'].map((item) => (
                <div key={item} className="flex items-center gap-3" style={{ fontSize: 13, color: dark ? '#555' : '#888' }}>
                  <div className="h-1.5 w-1.5 rounded-full bg-[#10b981] flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div {...inView(0.1)}>
            <div
              className="rounded-xl p-6 font-mono text-[12px]"
              style={{ border: `1px solid ${dark ? '#1a1a1a' : '#e5e5e5'}`, background: dark ? '#080808' : '#fafafa' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-[#10b981]" />
                <span style={{ fontSize: 11, color: dark ? '#333' : '#aaa' }}>encryption.ts</span>
              </div>
              <div className="space-y-1" style={{ color: dark ? '#333' : '#bbb' }}>
                <div>
                  <span style={{ color: dark ? '#555' : '#aaa' }}>const</span>{' '}
                  <span style={{ color: dark ? '#777' : '#666' }}>key</span> ={' '}
                  <span style={{ color: dark ? '#444' : '#999' }}>await</span> crypto.
                  <span style={{ color: dark ? 'white' : '#333' }}>generateKey</span>({'{'})
                </div>
                <div className="pl-4"><span style={{ color: dark ? '#555' : '#aaa' }}>name</span>: <span style={{ color: dark ? '#444' : '#888' }}>&apos;AES-GCM&apos;</span>,</div>
                <div className="pl-4"><span style={{ color: dark ? '#555' : '#aaa' }}>length</span>: <span style={{ color: dark ? '#777' : '#666' }}>256</span>,</div>
                <div>{'}'});</div>
                <div className="mt-3">
                  <span style={{ color: dark ? '#555' : '#aaa' }}>const</span>{' '}
                  <span style={{ color: dark ? '#777' : '#666' }}>encrypted</span> ={' '}
                  <span style={{ color: dark ? '#444' : '#999' }}>await</span>
                </div>
                <div className="pl-4">crypto.<span style={{ color: dark ? 'white' : '#333' }}>encrypt</span>(message, key);</div>
                <div className="mt-3" style={{ color: dark ? '#2a2a2a' : '#ddd' }}>{'// only recipient can decrypt'}</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="team" className="py-28 px-6 relative z-10" style={{ borderTop: `1px solid ${divider}` }}>
        <div className="max-w-5xl mx-auto text-center">
          <motion.div {...inView()} className="max-w-2xl mx-auto">
            <p style={{ fontSize: 11, color: dark ? '#444' : '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Team</p>
            <h2 className={`text-3xl md:text-4xl font-bold tracking-tight ${textColor} mb-5`}>
              Built by a tight team.
            </h2>
            <p style={{ fontSize: 13, color: dark ? '#555' : '#888', lineHeight: 1.7, marginBottom: 32 }}>
              Meet the two people shaping the Twiky experience from interface to product direction.
            </p>
          </motion.div>

          <motion.div {...inView(0.08)}>
            <AnimatedTooltipPreview />
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section id="download" className="py-28 px-6 relative z-10" style={{ borderTop: `1px solid ${divider}` }}>
        <div className="max-w-xl mx-auto text-center">
          <motion.div {...inView()}>
            <h2 className={`text-4xl font-bold tracking-[-0.03em] ${textColor} mb-4`}>Start messaging today.</h2>
            <p style={{ fontSize: 13, color: dark ? '#555' : '#888', marginBottom: 32 }}>
              Free forever. No credit card. Available on iOS, Android, and the web.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push(isAuthenticated ? '/chat' : '/account/signup')}
                className="h-9 px-5 rounded-md text-sm font-semibold transition-colors"
                style={{ background: dark ? 'white' : '#1d1d1f', color: dark ? 'black' : 'white' }}
              >
                Get started free
              </button>
              <button
                className="h-9 px-5 rounded-md text-sm transition-colors"
                style={{ border: dark ? '1px solid #222' : '1px solid #e5e5e5', color: dark ? '#888' : '#666', background: 'transparent' }}
              >
                Download app
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 relative z-10" style={{ borderTop: `1px solid ${divider}` }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill={dark ? 'white' : '#1d1d1f'}>
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
            Twiky
          </div>
          <div className="flex gap-6 text-[13px]" style={{ color: dark ? '#333' : '#bbb' }}>
            {['Privacy', 'Terms', 'Security', 'API', 'Blog'].map((l) => (
              <a key={l} href="#" className="hover:text-current transition-colors">{l}</a>
            ))}
          </div>
          <p style={{ color: dark ? '#2a2a2a' : '#ccc', fontSize: 11 }}>© {new Date().getFullYear()} Twiky</p>
        </div>
      </footer>
    </div>
  );
}
