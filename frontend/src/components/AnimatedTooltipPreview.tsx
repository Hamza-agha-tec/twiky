"use client";

import React from "react";

import { AnimatedTooltip } from "@/components/ui/animated-tooltip";

const people = [
  {
    id: 1,
    name: "Zakaria",
    designation: "Frontend Developer",
    signature: "Zakaria" as const,
    image:
      "https://res.cloudinary.com/dectxiuco/image/upload/q_auto/f_auto/v1775860636/caveman2_hnhf11.png",
  },
  {
    id: 2,
    name: "Hamza",
    designation: "Backend Developer",
    signature: "Hamza" as const,
    image:
      "https://res.cloudinary.com/dectxiuco/image/upload/q_auto/f_auto/v1775860636/caveman1_fs7sft.png",
  },
];

export function AnimatedTooltipPreview({ dark }: { dark: boolean }) {
  return (
    <div className="mb-10 w-full">
      <AnimatedTooltip dark={dark} items={people} />
    </div>
  );
}
