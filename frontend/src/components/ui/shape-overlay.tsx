'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const N = 6;
const THICKNESS = 7;
const REST0 = [22, 32, 44, 56, 66, 76];
const REST1 = [29, 39, 51, 63, 73, 83];

function buildD(pts: number[]) {
  const seg = (100 / (N - 1));
  let d = `M 0 ${pts[0]} C`;
  for (let j = 0; j < N - 1; j++) {
    const p  = ((j + 1) / (N - 1)) * 100;
    const cp = p - seg / 2;
    d += ` ${cp} ${pts[j]} ${cp} ${pts[j + 1]} ${p} ${pts[j + 1]}`;
  }
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
  const x0 = (si / segs) * 100, x1 = ((si + 1) / segs) * 100, cp = (x0 + x1) / 2;
  const y0 = pts[si], y1 = pts[si + 1];
  const bx = mt*mt*mt*x0 + 3*mt*mt*lt*cp + 3*mt*lt*lt*cp + lt*lt*lt*x1;
  const by = mt*mt*mt*y0 + 3*mt*mt*lt*y0 + 3*mt*lt*lt*y1 + lt*lt*lt*y1;
  const dxdt = 3*(mt*mt*(cp-x0) + 2*mt*lt*(cp-cp) + lt*lt*(x1-cp));
  const dydt = 3*(mt*mt*(y0-y0) + 2*mt*lt*(y1-y0) + lt*lt*(y1-y1));
  const angle = Math.atan2(dydt*(window.innerHeight/100), dxdt*(window.innerWidth/100))*(180/Math.PI);
  return { x: bx, y: by, angle };
}

const COLORS = ['#10b981','#06b6d4','#38bdf8','#34d399','#22d3ee','#6ee7b7'];

const SHAPES = [
  `<svg width="13" height="12" viewBox="0 0 24 22" fill="currentColor"><path d="M2 2h20v14H7l-5 5V2z"/></svg>`,
  `<svg width="13" height="10" viewBox="0 0 24 18" fill="currentColor"><rect x="1" y="1" width="22" height="16" rx="2"/><polyline points="1,1 12,10 23,1" stroke="rgba(0,0,0,0.25)" stroke-width="2" fill="none"/></svg>`,
  `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  `<svg width="7" height="7"  viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>`,
  `<svg width="15" height="9" viewBox="0 0 24 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="2,7 8,13 20,1"/><polyline points="9,7 15,13" opacity="0.5"/></svg>`,
];

function makeParticle(px: number, py: number, color: string, html: string, container: HTMLDivElement) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;left:${px}px;top:${py}px;pointer-events:none;transform:translate(-50%,-50%);color:${color};z-index:10;`;
  el.innerHTML = html;
  container.appendChild(el);
  return el;
}

// Rocket reaches END → explode outward + disappear
function explodeAndDie(px: number, py: number, container: HTMLDivElement, rocket: HTMLDivElement) {
  // Rocket shrinks + spins out
  gsap.to(rocket, { scale: 0, opacity: 0, rotate: '+=360', duration: 0.45, ease: 'back.in(2)' });

  const count = 14;
  for (let i = 0; i < count; i++) {
    const color = COLORS[i % COLORS.length];
    const el = makeParticle(px, py, color, SHAPES[i % SHAPES.length], container);
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist  = 60 + Math.random() * 90;
    gsap.fromTo(el,
      { scale: 0, opacity: 1, rotate: 0 },
      { x: Math.cos(angle)*dist, y: Math.sin(angle)*dist, scale: 0.5+Math.random()*0.9,
        opacity: 0, rotate: (Math.random()-0.5)*600, duration: 0.8+Math.random()*0.4,
        ease: 'power2.out', delay: i*0.02, onComplete: () => el.remove() }
    );
  }

  // Shockwave
  const ring = document.createElement('div');
  ring.style.cssText = `position:fixed;left:${px}px;top:${py}px;width:12px;height:12px;border-radius:50%;border:2px solid #10b981;pointer-events:none;transform:translate(-50%,-50%);z-index:9;`;
  container.appendChild(ring);
  gsap.to(ring, { width: 140, height: 140, opacity: 0, duration: 0.65, ease: 'power1.out', onComplete: () => ring.remove() });
}

// Rocket reaches START → particles converge IN → rocket materialises
function convergeAndRevive(px: number, py: number, container: HTMLDivElement, rocket: HTMLDivElement) {
  const count = 10;
  let arrived = 0;

  for (let i = 0; i < count; i++) {
    const color = COLORS[i % COLORS.length];
    const el = makeParticle(px, py, color, SHAPES[i % SHAPES.length], container);

    // Start scattered around the spawn point
    const spawnAngle = (i / count) * Math.PI * 2;
    const spawnDist  = 80 + Math.random() * 60;
    const sx = Math.cos(spawnAngle) * spawnDist;
    const sy = Math.sin(spawnAngle) * spawnDist;

    gsap.fromTo(el,
      { x: sx, y: sy, scale: 0.8+Math.random()*0.6, opacity: 0, rotate: (Math.random()-0.5)*360 },
      {
        x: 0, y: 0, scale: 0, opacity: 1, rotate: 0,
        duration: 0.55 + i * 0.04,
        ease: 'power3.in',
        delay: i * 0.04,
        onStart: () => gsap.to(el, { opacity: 1, duration: 0.15 }),
        onComplete: () => {
          el.remove();
          arrived++;
          // Last particle lands → rocket appears with flash
          if (arrived === count) {
            // Flash ring imploding
            const flash = document.createElement('div');
            flash.style.cssText = `position:fixed;left:${px}px;top:${py}px;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,0.45) 0%,transparent 70%);pointer-events:none;transform:translate(-50%,-50%);z-index:9;`;
            container.appendChild(flash);
            gsap.fromTo(flash,
              { scale: 1.6, opacity: 0.9 },
              { scale: 0.2, opacity: 0, duration: 0.4, ease: 'power2.in', onComplete: () => flash.remove() }
            );

            // Rocket materialises
            gsap.fromTo(rocket,
              { scale: 0, opacity: 0, rotate: '-=180' },
              { scale: 1, opacity: 1, rotate: '+=180', duration: 0.5, ease: 'back.out(2.5)' }
            );
          }
        },
      }
    );
  }
}

export function ShapeOverlay() {
  const path0Ref    = useRef<SVGPathElement>(null);
  const path1Ref    = useRef<SVGPathElement>(null);
  const rocketRef   = useRef<HTMLDivElement>(null);
  const particleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pts0 = Array(N).fill(0) as number[];
    const pts1 = Array(N).fill(0) as number[];
    const render = () => {
      path0Ref.current?.setAttribute('d', buildD(pts0));
      path1Ref.current?.setAttribute('d', buildD(pts1));
    };
    render();
    const tl = gsap.timeline({ onUpdate: render });
    for (let j = 0; j < N; j++) tl.to(pts0, { [j]: REST0[j], duration: 1.5, ease: 'power3.out' }, j*0.07);
    for (let j = 0; j < N; j++) tl.to(pts1, { [j]: REST1[j], duration: 1.5, ease: 'power3.out' }, 0.25+j*0.07);

    const state = {
      t: 0,
      lastScrollY: window.scrollY,
      lastDir: 1 as 1 | -1,
      flipAngle: 0,
      flipTween: null as gsap.core.Tween | null,
      explodedEnd:   false,
      explodedStart: false,
    };

    const tick = () => {
      const el = rocketRef.current;
      if (!el) return;
      const { x, y, angle } = getWavePoint(REST0, state.t);
      el.style.left      = `${(x/100)*window.innerWidth}px`;
      el.style.top       = `${(y/100)*window.innerHeight}px`;
      el.style.transform = `translate(-50%,-50%) rotate(${angle+45+state.flipAngle}deg)`;
    };
    gsap.ticker.add(tick);

    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      state.t = maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0;

      const container = particleRef.current;
      const rocket    = rocketRef.current;

      // ── END: explode + disappear
      if (state.t >= 0.995 && !state.explodedEnd && container && rocket) {
        state.explodedEnd = true;
        const { x, y } = getWavePoint(REST0, 1);
        explodeAndDie((x/100)*window.innerWidth, (y/100)*window.innerHeight, container, rocket);
      }
      if (state.t < 0.96) state.explodedEnd = false;

      // ── START: particles converge → rocket revives
      if (state.t <= 0.005 && !state.explodedStart && container && rocket) {
        state.explodedStart = true;
        const { x, y } = getWavePoint(REST0, 0);
        convergeAndRevive((x/100)*window.innerWidth, (y/100)*window.innerHeight, container, rocket);
      }
      if (state.t > 0.04) state.explodedStart = false;

      // ── Direction flip
      const dy = window.scrollY - state.lastScrollY;
      if (Math.abs(dy) > 2) {
        const newDir = dy > 0 ? 1 : -1;
        if (newDir !== state.lastDir) {
          state.lastDir = newDir;
          state.flipTween?.kill();
          state.flipTween = gsap.to(state, { flipAngle: newDir === 1 ? 0 : 180, duration: 0.5, ease: 'back.out(2)' });
        }
        state.lastScrollY = window.scrollY;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      tl.kill();
      state.flipTween?.kill();
      gsap.ticker.remove(tick);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <>
      <svg aria-hidden="true" className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex:1 }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="so-g0" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#10b981" stopOpacity="0.55"/>
            <stop offset="50%"  stopColor="#06b6d4" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.30"/>
          </linearGradient>
          <linearGradient id="so-g1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0.40"/>
            <stop offset="50%"  stopColor="#10b981" stopOpacity="0.28"/>
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.16"/>
          </linearGradient>
        </defs>
        <path ref={path0Ref} fill="url(#so-g0)"/>
        <path ref={path1Ref} fill="url(#so-g1)"/>
      </svg>

      <div ref={particleRef} aria-hidden="true" className="fixed inset-0 pointer-events-none" style={{ zIndex:10 }}/>

      <div ref={rocketRef} aria-hidden="true" className="fixed pointer-events-none select-none" style={{ zIndex:3 }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="#10b981" stroke="none" style={{ filter:'drop-shadow(0 0 8px rgba(16,185,129,0.8))' }}>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </div>
    </>
  );
}
