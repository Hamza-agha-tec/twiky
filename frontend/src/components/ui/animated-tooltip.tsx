"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

type TooltipItem = {
  id: number;
  name: string;
  designation: string;
  image: string;
};

export function AnimatedTooltip({
  items,
  className,
}: {
  items: TooltipItem[];
  className?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  return (
    <div className={cn("flex flex-row items-center justify-center", className)}>
      {items.map((item, index) => (
        <div
          key={item.id}
          className="-mr-4 relative"
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence>
            {hoveredIndex === index ? (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.96 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="absolute -top-20 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center rounded-xl border border-white/10 bg-neutral-950 px-4 py-2 text-center shadow-2xl"
              >
                <div className="whitespace-nowrap text-sm font-semibold text-white">
                  {item.name}
                </div>
                <div className="whitespace-nowrap text-xs text-neutral-400">
                  {item.designation}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.img
            whileHover={{ y: -4 }}
            src={item.image}
            alt={item.name}
            className="relative h-14 w-14 rounded-full border-2 border-white/15 object-cover object-center shadow-lg"
          />
        </div>
      ))}
    </div>
  );
}
