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
      "https://res.cloudinary.com/dectxiuco/image/upload/q_auto/f_auto/v1775835444/a-cartoon-caveman-sitting-at-a-table-with-a-laptop-vector_euprpw.jpg",
  },
  {
    id: 2,
    name: "Hamza",
    designation: "Backend Developer",
    signature: "Hamza" as const,
    image:
      "https://res.cloudinary.com/dectxiuco/image/upload/q_auto/f_auto/v1775835481/cartoon-caveman-sitting-at-a-table-with-a-laptop-vector_fiqcu4.jpg",
  },
];

export function AnimatedTooltipPreview({ dark }: { dark: boolean }) {
  return (
    <div className="mb-10 w-full">
      <AnimatedTooltip dark={dark} items={people} />
    </div>
  );
}
