'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const SelectContext = React.createContext(null);

const Select = ({ children, value, onValueChange, placeholder }) => {
    const [open, setOpen] = React.useState(false);
    const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 0 });
    const containerRef = React.useRef(null);

    const updateCoords = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
            });
        }
    };

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    React.useEffect(() => {
        if (open) {
            updateCoords();
            window.addEventListener('resize', updateCoords);
            window.addEventListener('scroll', updateCoords, true);
        }
        return () => {
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [open]);

    const handleSelect = (val) => {
        onValueChange?.(val);
        setOpen(false);
    };

    return (
        <SelectContext.Provider value={{ value, handleSelect, open, setOpen, placeholder, coords }}>
            <div className="relative inline-block w-fit" ref={containerRef}>
                {children}
            </div>
        </SelectContext.Provider>
    );
};

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
    const { open, setOpen, value, placeholder } = React.useContext(SelectContext);

    return (
        <button
            ref={ref}
            type="button"
            onClick={() => setOpen(!open)}
            className={cn(
                'flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-indigo-500',
                className
            )}
            {...props}
        >
            <span className="truncate">{value || placeholder || children}</span>
            <ChevronDown className={cn('h-4 w-4 ml-2 opacity-50 transition-transform duration-200', open && 'rotate-180')} />
        </button>
    );
});
SelectTrigger.displayName = 'SelectTrigger';

const SelectContent = ({ children, className }) => {
    const { open, coords } = React.useContext(SelectContext);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.2 }}
                    style={{
                        position: 'absolute',
                        top: coords.top + 4,
                        left: coords.left,
                    }}
                    className={cn(
                        'z-[9999] min-w-[120px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900',
                        className
                    )}
                >
                    <div className="max-h-60 overflow-y-auto">{children}</div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

const SelectItem = ({ children, value: itemValue, className }) => {
    const { value, handleSelect } = React.useContext(SelectContext);
    const isSelected = value === itemValue;

    return (
        <button
            type="button"
            onClick={() => handleSelect(itemValue)}
            className={cn(
                'relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-8 pr-2 text-sm outline-none transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 text-slate-700 dark:text-slate-300',
                isSelected && 'font-medium text-indigo-600 dark:text-indigo-400',
                className
            )}
        >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {isSelected && <Check className="h-4 w-4" />}
            </span>
            <span className="truncate">{children}</span>
        </button>
    );
};

const SelectValue = ({ placeholder }) => {
    const { value } = React.useContext(SelectContext);
    return <span>{value || placeholder}</span>;
};

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue };
