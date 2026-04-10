'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const N = 6;
const THICKNESS = 7; // ribbon height in SVG units
// Restored diagonal span
const REST0 = [22, 32, 44, 56, 66, 76];
const REST1 = [29, 39, 51, 63, 73, 83];

function buildD(pts: number[]) {
  const seg = (100 / (N - 1));
  // Top edge: left → right
  let d = `M 0 ${pts[0]} C`;
  for (let j = 0; j < N - 1; j++) {
    const p  = ((j + 1) / (N - 1)) * 100;
    const cp = p - seg / 2;
    d += ` ${cp} ${pts[j]} ${cp} ${pts[j + 1]} ${p} ${pts[j + 1]}`;
  }
  // Bottom edge: right → left (same curve shifted down by THICKNESS)
  d += ` V ${pts[N - 1] + THICKNESS}`;
  for (let j = N - 2; j >= 0; j--) {
    const p  = (j / (N - 1)) * 100;
    const cp = ((j + 1) / (N - 1)) * 100 - seg / 2;
    d += ` C ${cp} ${pts[j + 1] + THICKNESS} ${cp} ${pts[j] + THICKNESS} ${p} ${pts[j] + THICKNESS}`;
  }
  return d + ' Z';
}

function getWavePoint(pts: number[], t: number) {
  const segs = N - 1;
  const si   = Math.min(Math.floor(t * segs), segs - 1);
  const lt   = t * segs - si;
  const mt   = 1 - lt;

  const x0 = (si / segs) * 100;
  const x1 = ((si + 1) / segs) * 100;
  const cp = (x0 + x1) / 2;
  const y0 = pts[si], y1 = pts[si + 1];

  // Position on cubic bezier P0=(x0,y0) P1=(cp,y0) P2=(cp,y1) P3=(x1,y1)
  const bx = mt*mt*mt*x0 + 3*mt*mt*lt*cp + 3*mt*lt*lt*cp + lt*lt*lt*x1;
  const by = mt*mt*mt*y0 + 3*mt*mt*lt*y0 + 3*mt*lt*lt*y1 + lt*lt*lt*y1;

  // Derivative (tangent) — correct formula for this bezier
  // dB/dt = 3[(1-t)²(P1-P0) + 2(1-t)t(P2-P1) + t²(P3-P2)]
  const dxdt = 3 * (mt*mt*(cp - x0) + 2*mt*lt*(cp - cp) + lt*lt*(x1 - cp));
  const dydt = 3 * (mt*mt*(y0 - y0) + 2*mt*lt*(y1 - y0) + lt*lt*(y1 - y1));

  // Scale to screen aspect ratio for correct visual angle
  const scaleX = window.innerWidth  / 100;
  const scaleY = window.innerHeight / 100;
  const angle  = Math.atan2(dydt * scaleY, dxdt * scaleX) * (180 / Math.PI);

  return { x: bx, y: by, angle };
}

export function ShapeOverlay() {
  const path0Ref  = useRef<SVGPathElement>(null);
  const path1Ref  = useRef<SVGPathElement>(null);
  const rocketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pts0 = Array(N).fill(0) as number[];
    const pts1 = Array(N).fill(0) as number[];

    const render = () => {
      path0Ref.current?.setAttribute('d', buildD(pts0));
      path1Ref.current?.setAttribute('d', buildD(pts1));
    };

    render();

    const tl = gsap.timeline({ onUpdate: render });
    for (let j = 0; j < N; j++) {
      tl.to(pts0, { [j]: REST0[j], duration: 1.5, ease: 'power3.out' }, j * 0.07);
    }
    for (let j = 0; j < N; j++) {
      tl.to(pts1, { [j]: REST1[j], duration: 1.5, ease: 'power3.out' }, 0.25 + j * 0.07);
    }

    const onScroll = () => {
      const el = rocketRef.current;
      if (!el) return;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const t = maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0;
      const { x, y, angle } = getWavePoint(REST0, t);
      el.style.left      = `${(x / 100) * window.innerWidth}px`;
      el.style.top       = `${(y / 100) * window.innerHeight}px`;
      el.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { tl.kill(); window.removeEventListener('scroll', onScroll); };
  }, []);

  return (
    <>
      <svg
        aria-hidden="true"
        className="fixed inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="so-g0" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#10b981" stopOpacity="0.55" />
            <stop offset="50%"  stopColor="#06b6d4" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.30" />
          </linearGradient>
          <linearGradient id="so-g1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0.40" />
            <stop offset="50%"  stopColor="#10b981" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.16" />
          </linearGradient>
        </defs>
        <path ref={path0Ref} fill="url(#so-g0)" />
        <path ref={path1Ref} fill="url(#so-g1)" />
      </svg>

      <div
        ref={rocketRef}
        aria-hidden="true"
        className="fixed pointer-events-none select-none"
        style={{ zIndex: 3 }}
      >
        <svg
          width="30" height="30" viewBox="0 0 24 24"
          fill="#10b981" stroke="none"
          style={{ filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.8))' }}
        >
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </div>
    </>
  );
}
