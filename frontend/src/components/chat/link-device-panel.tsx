'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LinkDevicePanelProps {
  onBack: () => void;
}

/* ── Deterministic fake QR grid (25×25) ─────────────────────────────── */
function buildQrMatrix(): boolean[][] {
  const SIZE = 25;
  const m: boolean[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

  // Finder patterns (top-left, top-right, bottom-left)
  const addFinder = (r: number, c: number) => {
    for (let dr = 0; dr < 7; dr++) {
      for (let dc = 0; dc < 7; dc++) {
        m[r + dr][c + dc] =
          dr === 0 || dr === 6 || dc === 0 || dc === 6 ||
          (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
      }
    }
  };
  addFinder(0, 0);
  addFinder(0, SIZE - 7);
  addFinder(SIZE - 7, 0);

  // Timing patterns
  for (let i = 8; i < SIZE - 8; i++) {
    m[6][i] = i % 2 === 0;
    m[i][6] = i % 2 === 0;
  }

  // Seeded pseudo-random data modules (avoid finder/timing zones)
  let seed = 0x3f7a9c2b;
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  const reserved = (r: number, c: number) =>
    (r < 9 && c < 9) || (r < 9 && c >= SIZE - 8) || (r >= SIZE - 8 && c < 9) || r === 6 || c === 6;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!reserved(r, c)) m[r][c] = rand() > 0.48;
    }
  }
  return m;
}

const QR_MATRIX = buildQrMatrix();

function QrCode({ dim = 176 }: { dim?: number }) {
  const SIZE = QR_MATRIX.length;
  const cell = dim / SIZE;
  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} style={{ display: 'block' }}>
      <rect width={dim} height={dim} fill="white" rx="8" />
      {QR_MATRIX.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * cell + 0.5}
              y={r * cell + 0.5}
              width={cell - 0.5}
              height={cell - 0.5}
              rx={cell * 0.15}
              fill="#111"
            />
          ) : null
        )
      )}
    </svg>
  );
}

const STEPS = [
  'Open Twiky on your phone',
  'Go to Settings → Linked Devices',
  'Tap "Link a Device" and scan',
];

const EXPIRE_SECS = 60;

export function LinkDevicePanel({ onBack }: LinkDevicePanelProps) {
  const [secondsLeft, setSecondsLeft] = useState(EXPIRE_SECS);
  const [expired, setExpired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (expired || refreshing) return;
    if (secondsLeft <= 0) { setExpired(true); return; }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, expired, refreshing]);

  function refresh() {
    setRefreshing(true);
    setTimeout(() => {
      setSecondsLeft(EXPIRE_SECS);
      setExpired(false);
      setRefreshing(false);
    }, 800);
  }

  const progress = secondsLeft / EXPIRE_SECS;
  const radius = 10;
  const circ = 2 * Math.PI * radius;

  return (
    <motion.div
      initial={{ x: 280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 280, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 34 }}
      className="fixed left-0 top-0 h-full w-80 z-[70] bg-sidebar border-r border-border flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="h-14 px-2 flex items-center gap-1 border-b border-border flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold text-foreground text-sm ml-1">Link a Device</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-between px-5 py-6 overflow-y-auto">

        {/* QR area */}
        <div className="flex flex-col items-center gap-5 w-full">
          <div className="relative">
            {/* Timer ring */}
            <svg
              width={200}
              height={200}
              className="absolute -inset-3"
              style={{ top: -12, left: -12 }}
            >
              <circle cx={100} cy={100} r={radius + 76} fill="none" stroke="var(--border)" strokeWidth={2} />
              <circle
                cx={100}
                cy={100}
                r={radius + 76}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2}
                strokeDasharray={circ * 2 * Math.PI * (radius + 76) / radius}
                strokeDashoffset={(1 - progress) * (circ * 2 * Math.PI * (radius + 76) / radius)}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>

            {/* QR or expired overlay */}
            <motion.div
              className="relative rounded-2xl overflow-hidden shadow-lg"
              style={{ width: 176, height: 176 }}
            >
              <QrCode dim={176} />

              {/* Expired overlay */}
              {(expired || refreshing) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2"
                >
                  {refreshing ? (
                    <RefreshCw className="h-7 w-7 text-muted-foreground animate-spin" />
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-foreground">Code expired</p>
                      <button
                        onClick={refresh}
                        className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-70 transition-opacity"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </motion.div>

            {/* Countdown badge */}
            {!expired && !refreshing && (
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-sidebar border border-border rounded-full flex items-center gap-1">
                <svg width={22} height={22}>
                  <circle cx={11} cy={11} r={radius} fill="none" stroke="var(--muted)" strokeWidth={2} />
                  <circle
                    cx={11} cy={11} r={radius}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - progress)}
                    strokeLinecap="round"
                    transform="rotate(-90 11 11)"
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <span className="text-[10px] font-semibold text-muted-foreground tabular-nums w-5">{secondsLeft}s</span>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="w-full mt-4 flex flex-col gap-2.5">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.07 }}
                className="flex items-center gap-3"
              >
                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <p className="text-xs text-muted-foreground">{step}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full mt-6 flex items-start gap-2.5 bg-muted rounded-xl px-3.5 py-3"
        >
          <Smartphone className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Your phone must be connected to the internet. Messages sync automatically after linking.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
