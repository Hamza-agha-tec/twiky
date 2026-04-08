'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const TabsContext = React.createContext(null);

const Tabs = ({ children, value, onValueChange, className }) => {
    return (
        <TabsContext.Provider value={{ value, onValueChange }}>
            <div className={cn('w-full', className)}>{children}</div>
        </TabsContext.Provider>
    );
};

const TabsList = ({ children, className }) => {
    return (
        <div
            className={cn(
                'inline-flex h-10 items-center justify-center rounded-xl bg-slate-100 p-1 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                className
            )}
        >
            {children}
        </div>
    );
};

const TabsTrigger = ({ children, value: itemValue, className }) => {
    const { value, onValueChange } = React.useContext(TabsContext);
    const isActive = value === itemValue;

    return (
        <button
            type="button"
            onClick={() => onValueChange?.(itemValue)}
            className={cn(
                'relative cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-slate-950 dark:focus-visible:ring-indigo-500',
                isActive ? 'text-slate-950 dark:text-slate-50' : 'hover:text-slate-700 dark:hover:text-slate-300',
                className
            )}
        >
            {isActive && (
                <motion.div
                    layoutId="tabs-active"
                    className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-slate-950"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
            )}
            <span className="relative z-10">{children}</span>
        </button>
    );
};

const TabsContent = ({ children, value: itemValue, className }) => {
    const { value } = React.useContext(TabsContext);
    const isActive = value === itemValue;

    if (!isActive) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className={cn('mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:ring-offset-slate-950 dark:focus-visible:ring-indigo-500', className)}
        >
            {children}
        </motion.div>
    );
};

export { Tabs, TabsList, TabsTrigger, TabsContent };
