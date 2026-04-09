"use client";

import React from "react";

import { AnimatedTooltip } from "@/components/ui/animated-tooltip";

const people = [
  {
    id: 1,
    name: "Zakaria",
    designation: "Frontend Developer",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: 2,
    name: "Hamza",
    designation: "Backend Developer",
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
  },
];

export function AnimatedTooltipPreview() {
  return (
    <div className="mb-10 w-full">
      <AnimatedTooltip items={people} />
    </div>
  );
}
