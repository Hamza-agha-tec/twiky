'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef(({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        data-state={checked ? 'checked' : 'unchecked'}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange?.(!checked)}
        ref={ref}
        className={cn(
            "peer h-4 w-4 shrink-0 rounded-sm border border-slate-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-indigo-600 data-[state=checked]:text-slate-50 dark:border-slate-50 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300 dark:data-[state=checked]:bg-indigo-500 dark:data-[state=checked]:text-slate-900",
            className
        )}
        {...props}
    >
        <div
            className={cn("flex items-center justify-center text-current")}
            style={{ visibility: checked ? 'visible' : 'hidden' }}
        >
            <Check className="h-3 w-3" strokeWidth={3} />
        </div>
    </button>
));
Checkbox.displayName = "Checkbox";

export { Checkbox };
