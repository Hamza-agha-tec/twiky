"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef(({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const handleChange = (e) => {
        const newValue = parseFloat(e.target.value)
        onValueChange?.([newValue])
    }

    const currentValue = Array.isArray(value) ? value[0] : value || 0
    const percentage = ((currentValue - min) / (max - min)) * 100

    return (
        <div className={cn("relative flex w-full touch-none select-none items-center py-4", className)}>
            <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                    className="absolute h-full bg-indigo-600 dark:bg-indigo-500"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={currentValue}
                onChange={handleChange}
                ref={ref}
                className="absolute h-2 w-full cursor-pointer appearance-none bg-transparent opacity-0 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none"
                {...props}
            />
            {/* Visual Thumb */}
            <div
                className="pointer-events-none absolute h-5 w-5 rounded-full border-2 border-indigo-600 bg-white ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-indigo-500 dark:bg-slate-950 dark:ring-offset-slate-950"
                style={{ left: `calc(${percentage}% - 10px)` }}
            />
        </div>
    )
})
Slider.displayName = "Slider"

export { Slider }
