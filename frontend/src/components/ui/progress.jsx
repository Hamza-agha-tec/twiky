"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef(({ className, value, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "relative h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800",
            className
        )}
        {...props}
    >
        <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${value || 0}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full w-full flex-1 bg-indigo-600 transition-all dark:bg-indigo-500"
        />
    </div>
))
Progress.displayName = "Progress"

export { Progress }
