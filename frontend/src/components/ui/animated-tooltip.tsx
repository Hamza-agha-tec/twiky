"use client";

import * as React from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";

import { TeamSignature } from "@/components/ZakariaSignature";
import { cn } from "@/lib/utils";

type TooltipItem = {
  id: number;
  name: string;
  designation: string;
  image: string;
  signature: "Zakaria" | "Hamza";
};

export function AnimatedTooltip({
  items,
  className,
  dark = true,
}: {
  items: TooltipItem[];
  className?: string;
  dark?: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [autoIndex, setAutoIndex] = React.useState(0);
  const [started, setStarted] = React.useState(false);
  const pausedRef = React.useRef(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: false, margin: "-80px" });

  React.useEffect(() => {
    if (isInView && !started) setStarted(true);
  }, [isInView, started]);

  // Track hover pause without re-renders
  React.useEffect(() => {
    pausedRef.current = hoveredIndex !== null;
  }, [hoveredIndex]);

  const handleSignatureComplete = React.useCallback(() => {
    if (pausedRef.current) return;
    // Small pause after last stroke, then switch
    setTimeout(() => {
      if (!pausedRef.current) {
        setAutoIndex((i) => (i + 1) % items.length);
      }
    }, 600);
  }, [items.length]);

  const activeIndex = hoveredIndex ?? (started ? autoIndex : null);
  const activeItem = activeIndex !== null ? items[activeIndex] : null;

  return (
    <div ref={containerRef} className={cn("flex flex-col items-center justify-center", className)}>
      <div className="inline-flex items-center justify-center">
        {items.map((item, index) => {
          const isActive = activeIndex === index;
          return (
            <div
              key={item.id}
              className={cn("relative", index > 0 && "-ml-4")}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Tooltip */}
              <AnimatePresence>
                {isActive && (() => {
                  const isLeft = index === 0;
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: isLeft ? -10 : 10, y: 4, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: isLeft ? -8 : 8, y: 4, scale: 0.92 }}
                      transition={{ type: "spring", stiffness: 420, damping: 30 }}
                      className="absolute z-50 flex flex-col justify-center rounded-xl px-3 py-1.5 shadow-xl"
                      style={{
                        ...(isLeft
                          ? { right: "calc(100% + 8px)" }
                          : { left: "calc(100% + 8px)" }),
                        top: 0,
                        minWidth: 110,
                        background: dark ? '#111' : '#f0f0f0',
                        border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.07)',
                      }}
                    >
                      <div className="whitespace-nowrap text-xs font-semibold" style={{ color: dark ? '#fff' : '#111' }}>
                        {item.name}
                      </div>
                      <div className="whitespace-nowrap text-[10px] mt-0.5" style={{ color: dark ? '#888' : '#666' }}>
                        {item.designation}
                      </div>
                      {/* Arrow */}
                      <div
                        className="absolute top-3 h-2 w-2 rotate-45"
                        style={isLeft
                          ? { right: -5, background: dark ? '#111' : '#f0f0f0', borderTopWidth: 1, borderRightWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }
                          : { left: -5, background: dark ? '#111' : '#f0f0f0', borderBottomWidth: 1, borderLeftWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }
                        }
                      />
                    </motion.div>
                  );
                })()}
              </AnimatePresence>

              {/* Avatar */}
              <motion.img
                animate={isActive ? { y: -5, scale: 1.08 } : { y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                src={item.image}
                alt={item.name}
                className="relative h-14 w-14 rounded-full border-2 object-cover object-center shadow-lg cursor-pointer"
                style={{
                  borderColor: isActive
                    ? dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)'
                    : 'rgba(255,255,255,0.15)',
                }}
              />

            </div>
          );
        })}
      </div>

      {/* Signature area */}
      <div className="mt-6 flex min-h-[92px] w-full items-start justify-center">
        <AnimatePresence mode="wait">
          {activeItem ? (
            <TeamSignature
              key={`${activeItem.id}-${autoIndex}-${hoveredIndex}`}
              dark={dark}
              name={activeItem.signature}
              onComplete={hoveredIndex === null ? handleSignatureComplete : undefined}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
