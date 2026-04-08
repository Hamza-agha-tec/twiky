'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

const Sheet = ({ children, open, onOpenChange }) => {
    const [isOpen, setIsOpen] = React.useState(open || false);

    React.useEffect(() => {
        if (open !== undefined) setIsOpen(open);
    }, [open]);

    const handleOpenChange = (val) => {
        setIsOpen(val);
        onOpenChange?.(val);
    };

    return React.Children.map(children, (child) => {
        if (child.type === SheetTrigger) {
            return React.cloneElement(child, { onClick: () => handleOpenChange(true) });
        }
        if (child.type === SheetContent) {
            return (
                <AnimatePresence>
                    {isOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => handleOpenChange(false)}
                                className="h-full fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm"
                            />
                            <motion.div
                                layout
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'tween', ease: 'easeInOut', duration: 0.4, layout: { duration: 0.4, ease: 'easeInOut' } }}
                                className={cn(
                                    'fixed inset-y-0 right-0 z-50 h-full w-full max-w-sm border-l border-slate-200 bg-white p-6 shadow-lg transition ease-in-out dark:border-slate-800 dark:bg-slate-950',
                                    child.props.className
                                )}
                            >
                                {child.props.children}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            );
        }
        return child;
    });
};

const SheetTrigger = ({ children, onClick, asChild }) => {
    if (asChild) {
        return React.cloneElement(children, { onClick });
    }
    return <button onClick={onClick}>{children}</button>;
};

const SheetContent = ({ children }) => <>{children}</>;

const SheetHeader = ({ className, ...props }) => (
    <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
);

const SheetTitle = ({ className, ...props }) => (
    <h2 className={cn('text-lg font-semibold text-slate-950 dark:text-slate-50', className)} {...props} />
);

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle };
